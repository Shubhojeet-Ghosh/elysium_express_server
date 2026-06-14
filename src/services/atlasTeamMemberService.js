const AtlasTeam = require("../models/atlas_teams");
const AtlasTeamInvitation = require("../models/atlas_team_invitations");
const AtlasTeamMember = require("../models/atlas_team_members");
const ElysiumAtlasUser = require("../models/elysium_atlas_users");

const { generateJwtToken, verifyJwtToken } = require("./jwtService");
const { sendHtmlEmail } = require("./emailSenderService");
const { validateEmail } = require("./validateEmail");
const { generateTeamInviteEmail } = require("./atlasTeamInviteEmailTemplateService");
const {
  refreshTeamMemberCount,
  getOwnerMaxTeamMembers,
} = require("./atlasTeamService");
const {
  checkTeamPermission,
  TEAM_ACTIONS,
} = require("./atlasTeamPermissionService");
const {
  INVITE_TOKEN_TYPE,
  INVITE_TTL_DAYS,
  INVITE_TTL_JWT,
  MAX_INVITE_BATCH_SIZE,
  DEFAULT_MEMBER_ROLE,
  INVITABLE_ROLES,
} = require("../constants/atlasTeamInviteConstants");
const { TEAM_OWNER_ROLE } = require("../constants/atlasTeamRoleConstants");

const ATLAS_FRONTEND_BASE_URL =
  process.env.ATLAS_FRONTEND_BASE_URL || "localhost:3000";

const normalizeEmail = (email) => email?.toLowerCase().trim();

const buildInviteExpiryDate = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  return expiresAt;
};

const buildInviteToken = (invitation) =>
  generateJwtToken(
    {
      type: INVITE_TOKEN_TYPE,
      invitation_id: String(invitation._id),
      team_id: invitation.team_id,
      invitee_user_id: invitation.invitee_user_id,
      inviter_user_id: invitation.inviter_user_id,
    },
    INVITE_TTL_JWT,
  );

const buildInviteLink = (token) =>
  `${ATLAS_FRONTEND_BASE_URL}/team/invite/respond?token=${token}`;

const formatInviterName = (user) => {
  const parts = [user?.first_name, user?.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
};

const sendInviteEmail = async ({
  inviteeEmail,
  inviterUser,
  team,
  inviteToken,
}) => {
  const html = generateTeamInviteEmail({
    inviteeEmail,
    inviterName: formatInviterName(inviterUser),
    teamName: team?.team_name,
    inviteLink: buildInviteLink(inviteToken),
    expiresInDays: INVITE_TTL_DAYS,
  });

  await sendHtmlEmail({
    to: inviteeEmail,
    subject: `You're invited to join ${team?.team_name || "a team"} on Elysium Atlas`,
    html,
  });
};

const verifyInviteToken = (token) => {
  const decoded = verifyJwtToken(token);
  if (!decoded || decoded.type !== INVITE_TOKEN_TYPE) {
    return null;
  }

  const required = [
    "invitation_id",
    "team_id",
    "invitee_user_id",
    "inviter_user_id",
  ];

  if (required.some((field) => !decoded[field])) {
    return null;
  }

  return decoded;
};

const tokenMatchesInvitation = (decoded, invitation) =>
  decoded.invitation_id === String(invitation._id) &&
  decoded.team_id === invitation.team_id &&
  decoded.invitee_user_id === invitation.invitee_user_id &&
  decoded.inviter_user_id === invitation.inviter_user_id;

const isInvitationExpired = (invitation) =>
  invitation.status === "expired" ||
  (invitation.expires_at && invitation.expires_at.getTime() < Date.now());

const countActiveTeamMembers = async (teamId) =>
  AtlasTeamMember.countDocuments({
    team_id: String(teamId),
    status: "active",
  });

const countPendingInvitations = async (teamId) =>
  AtlasTeamInvitation.countDocuments({
    team_id: String(teamId),
    status: "pending",
    expires_at: { $gt: new Date() },
  });

/**
 * Capacity from atlas_teams (source of truth). Refreshes member_count before read.
 */
const getTeamCapacitySnapshot = async (ownerUserId, teamId) => {
  const [team, pendingInvites] = await Promise.all([
    refreshTeamMemberCount(teamId),
    countPendingInvitations(teamId),
  ]);

  const maxTeamMembers =
    team?.max_members ?? (await getOwnerMaxTeamMembers(ownerUserId));
  const memberCount = team?.member_count ?? 1;
  const activeMembers = Math.max(0, memberCount - 1);
  const remainingSlots = Math.max(
    0,
    maxTeamMembers - memberCount - pendingInvites,
  );

  return {
    maxTeamMembers,
    memberCount,
    activeMembers,
    pendingInvites,
    currentTeamSize: memberCount,
    remainingSlots,
  };
};

const createOrRefreshInvitation = async ({
  team,
  inviterUserId,
  inviteeUser,
  role,
  existingInvitation,
}) => {
  const expiresAt = buildInviteExpiryDate();
  const inviteeEmail = normalizeEmail(inviteeUser.email);
  const teamId = String(team._id);

  let invitation = existingInvitation;

  if (invitation) {
    invitation = await AtlasTeamInvitation.findOneAndUpdate(
      { _id: invitation._id, status: "pending" },
      {
        $set: {
          expires_at: expiresAt,
          role,
          inviter_user_id: String(inviterUserId),
        },
      },
      { new: true },
    );
  } else {
    invitation = await AtlasTeamInvitation.create({
      team_id: teamId,
      inviter_user_id: String(inviterUserId),
      invitee_user_id: String(inviteeUser._id),
      invitee_email: inviteeEmail,
      role,
      status: "pending",
      expires_at: expiresAt,
    });
  }

  if (!invitation) {
    return null;
  }

  const inviteToken = buildInviteToken(invitation);
  return { invitation, inviteToken };
};

/**
 * Batch-invite emails to a team. Requires owner or admin role for teamId.
 */
const inviteTeamMembers = async ({
  userId,
  userEmail,
  teamId,
  emails,
  role = DEFAULT_MEMBER_ROLE,
}) => {
  if (!Array.isArray(emails) || emails.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: "At least one email is required.",
      },
    };
  }

  if (emails.length > MAX_INVITE_BATCH_SIZE) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: `You can invite up to ${MAX_INVITE_BATCH_SIZE} emails per request.`,
      },
    };
  }

  if (role && !INVITABLE_ROLES.includes(role)) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: 'Invalid role. Must be "admin" or "member".',
      },
    };
  }

  const resolvedTeamId = teamId || null;
  const permission = await checkTeamPermission(
    userId,
    resolvedTeamId,
    TEAM_ACTIONS.INVITE_MEMBERS,
  );

  if (!permission.allowed) {
    return {
      ok: false,
      statusCode: permission.statusCode,
      body: {
        success: false,
        message: permission.message,
      },
    };
  }

  const team = permission.team;
  const ownerUserId = permission.ownerUserId;
  const actorEmailNorm = normalizeEmail(userEmail);
  const inviterUser = await ElysiumAtlasUser.findById(userId).lean();

  const seenEmails = new Set();
  const normalizedInput = [];

  for (const rawEmail of emails) {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      normalizedInput.push({ rawEmail, email: null });
      continue;
    }
    if (seenEmails.has(email)) {
      normalizedInput.push({ rawEmail, email, duplicateInBatch: true });
      continue;
    }
    seenEmails.add(email);
    normalizedInput.push({ rawEmail, email });
  }

  const validEmails = normalizedInput
    .filter((entry) => entry.email && !entry.duplicateInBatch)
    .map((entry) => entry.email);

  const [users, activeMembers, pendingInvitations] = await Promise.all([
    ElysiumAtlasUser.find({ email: { $in: validEmails } }).lean(),
    AtlasTeamMember.find({
      team_id: String(team._id),
      status: "active",
    }).lean(),
    AtlasTeamInvitation.find({
      team_id: String(team._id),
      invitee_email: { $in: validEmails },
      status: "pending",
      expires_at: { $gt: new Date() },
    }).lean(),
  ]);

  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const membersByUserId = new Map(
    activeMembers.map((member) => [member.user_id, member]),
  );
  const pendingByEmail = new Map(
    pendingInvitations.map((invite) => [invite.invitee_email, invite]),
  );

  let { remainingSlots } = await getTeamCapacitySnapshot(ownerUserId, team._id);
  const results = [];

  for (const entry of normalizedInput) {
    const displayEmail = entry.rawEmail ?? entry.email ?? "";

    if (!entry.email) {
      results.push({ email: displayEmail, status: "invalid_email" });
      continue;
    }

    if (entry.duplicateInBatch) {
      results.push({ email: entry.email, status: "duplicate_in_request" });
      continue;
    }

    if (!validateEmail(entry.email)) {
      results.push({ email: entry.email, status: "invalid_email" });
      continue;
    }

    if (entry.email === actorEmailNorm) {
      results.push({ email: entry.email, status: "self_invite" });
      continue;
    }

    const user = usersByEmail.get(entry.email);
    if (!user) {
      results.push({ email: entry.email, status: "not_registered" });
      continue;
    }

    if (!user.is_profile_complete) {
      results.push({
        email: entry.email,
        status: "profile_incomplete",
        user_id: String(user._id),
      });
      continue;
    }

    if (membersByUserId.has(String(user._id))) {
      results.push({
        email: entry.email,
        status: "already_member",
        user_id: String(user._id),
      });
      continue;
    }

    const existingPending = pendingByEmail.get(entry.email);
    const consumesSlot = !existingPending;

    if (consumesSlot && remainingSlots <= 0) {
      results.push({ email: entry.email, status: "team_full" });
      continue;
    }

    try {
      const inviteResult = await createOrRefreshInvitation({
        team,
        inviterUserId: userId,
        inviteeUser: user,
        role,
        existingInvitation: existingPending || null,
      });

      if (!inviteResult) {
        results.push({ email: entry.email, status: "invitation_unavailable" });
        continue;
      }

      await sendInviteEmail({
        inviteeEmail: entry.email,
        inviterUser,
        team,
        inviteToken: inviteResult.inviteToken,
      });

      if (consumesSlot) {
        remainingSlots -= 1;
      }

      pendingByEmail.set(entry.email, inviteResult.invitation);

      results.push({
        email: entry.email,
        status: existingPending ? "already_invited" : "invited",
        email_resent: Boolean(existingPending),
        invitation_id: String(inviteResult.invitation._id),
        user_id: String(user._id),
        expires_at: inviteResult.invitation.expires_at,
      });
    } catch (err) {
      console.error("Failed to invite team member:", entry.email, err);
      results.push({ email: entry.email, status: "email_send_failed" });
    }
  }

  const summary = results.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status === "invited" || item.status === "already_invited") {
        acc.processed += 1;
      } else {
        acc.skipped += 1;
      }
      return acc;
    },
    { total: results.length, processed: 0, skipped: 0 },
  );

  return {
    ok: true,
    statusCode: 200,
    body: {
      success: true,
      message: "Invitation batch processed.",
      team_id: String(team._id),
      summary,
      results,
    },
  };
};

const getInvitationPreview = async (token) => {
  const decoded = verifyInviteToken(token);
  if (!decoded) {
    return {
      ok: false,
      body: {
        success: false,
        message: "Invalid or expired invitation.",
      },
    };
  }

  const invitation = await AtlasTeamInvitation.findById(
    decoded.invitation_id,
  ).lean();

  if (!invitation || !tokenMatchesInvitation(decoded, invitation)) {
    return {
      ok: false,
      body: {
        success: false,
        message: "Invalid or expired invitation.",
      },
    };
  }

  if (invitation.status !== "pending" || isInvitationExpired(invitation)) {
    return {
      ok: false,
      body: {
        success: false,
        message: "This invitation is no longer available.",
        invitation_status: invitation.status,
      },
    };
  }

  const [team, inviter, invitee] = await Promise.all([
    AtlasTeam.findById(invitation.team_id).lean(),
    ElysiumAtlasUser.findById(invitation.inviter_user_id).lean(),
    ElysiumAtlasUser.findById(invitation.invitee_user_id).lean(),
  ]);

  if (!team || !inviter || !invitee || !invitee.is_profile_complete) {
    return {
      ok: false,
      body: {
        success: false,
        message: "This invitation is no longer valid.",
      },
    };
  }

  return {
    ok: true,
    body: {
      success: true,
      invitation: {
        invitation_id: String(invitation._id),
        team_id: invitation.team_id,
        team_name: team.team_name,
        inviter: {
          user_id: String(inviter._id),
          email: inviter.email,
          first_name: inviter.first_name || "",
          last_name: inviter.last_name || "",
        },
        invitee: {
          user_id: String(invitee._id),
          email: invitee.email,
          first_name: invitee.first_name || "",
          last_name: invitee.last_name || "",
        },
        role: invitation.role,
        expires_at: invitation.expires_at,
        status: invitation.status,
      },
    },
  };
};

const respondToInvitation = async ({ token, accept }) => {
  const decoded = verifyInviteToken(token);
  if (!decoded) {
    return {
      ok: false,
      body: {
        success: false,
        message: "Invalid or expired invitation.",
      },
    };
  }

  const invitation = await AtlasTeamInvitation.findById(
    decoded.invitation_id,
  );

  if (!invitation || !tokenMatchesInvitation(decoded, invitation)) {
    return {
      ok: false,
      body: {
        success: false,
        message: "Invalid or expired invitation.",
      },
    };
  }

  if (invitation.status !== "pending" || isInvitationExpired(invitation)) {
    return {
      ok: false,
      body: {
        success: false,
        message: "This invitation is no longer available.",
        invitation_status: invitation.status,
      },
    };
  }

  const now = new Date();

  if (accept === false) {
    invitation.status = "declined";
    invitation.responded_at = now;
    await invitation.save();

    return {
      ok: true,
      body: {
        success: true,
        message: "Invitation declined.",
      },
    };
  }

  if (accept !== true) {
    return {
      ok: false,
      body: {
        success: false,
        message: "The accept field must be true or false.",
      },
    };
  }

  const [team, invitee] = await Promise.all([
    AtlasTeam.findById(invitation.team_id),
    ElysiumAtlasUser.findById(invitation.invitee_user_id).lean(),
  ]);

  if (!team || team.status !== "active" || !team.is_active) {
    return {
      ok: false,
      body: {
        success: false,
        message: "This team is no longer available.",
      },
    };
  }

  if (!invitee || !invitee.is_profile_complete) {
    return {
      ok: false,
      body: {
        success: false,
        message: "Your account is not eligible to join this team.",
      },
    };
  }

  const existingMember = await AtlasTeamMember.findOne({
    team_id: invitation.team_id,
    user_id: invitation.invitee_user_id,
    status: "active",
  }).lean();

  if (existingMember) {
    invitation.status = "accepted";
    invitation.responded_at = now;
    await invitation.save();

    return {
      ok: true,
      body: {
        success: true,
        message: "You are already a member of this team.",
        membership: {
          team_id: invitation.team_id,
          team_name: team.team_name,
          role: existingMember.role,
          joined_at: existingMember.joined_at,
        },
      },
    };
  }

  const removedMember = await AtlasTeamMember.findOne({
    team_id: invitation.team_id,
    user_id: invitation.invitee_user_id,
    status: "removed",
  }).lean();

  const lockedInvitation = await AtlasTeamInvitation.findOneAndUpdate(
    {
      _id: invitation._id,
      status: "pending",
      expires_at: { $gt: now },
    },
    {
      $set: {
        status: "accepted",
        responded_at: now,
      },
    },
    { new: true },
  );

  if (!lockedInvitation) {
    return {
      ok: false,
      body: {
        success: false,
        message: "This invitation is no longer available.",
      },
    };
  }

  const maxTeamMembers = await getOwnerMaxTeamMembers(team.owner_user_id);
  const refreshedTeam = await refreshTeamMemberCount(invitation.team_id);
  const memberCount = refreshedTeam?.member_count ?? 1;

  if (memberCount >= maxTeamMembers) {
    lockedInvitation.status = "pending";
    lockedInvitation.responded_at = null;
    await lockedInvitation.save();

    return {
      ok: false,
      body: {
        success: false,
        message: "Team is full.",
      },
    };
  }

  try {
    let member;

    if (removedMember) {
      member = await AtlasTeamMember.findOneAndUpdate(
        {
          _id: removedMember._id,
          status: "removed",
        },
        {
          $set: {
            status: "active",
            email: invitation.invitee_email,
            role: invitation.role,
            invited_by_user_id: invitation.inviter_user_id,
            invitation_id: String(invitation._id),
            joined_at: now,
          },
        },
        { new: true },
      );

      if (!member) {
        lockedInvitation.status = "pending";
        lockedInvitation.responded_at = null;
        await lockedInvitation.save();

        return {
          ok: false,
          body: {
            success: false,
            message: "Unable to process invitation.",
          },
        };
      }
    } else {
      member = await AtlasTeamMember.create({
        team_id: invitation.team_id,
        user_id: invitation.invitee_user_id,
        email: invitation.invitee_email,
        role: invitation.role,
        status: "active",
        invited_by_user_id: invitation.inviter_user_id,
        invitation_id: String(invitation._id),
        joined_at: now,
      });
    }

    await refreshTeamMemberCount(invitation.team_id);

    return {
      ok: true,
      body: {
        success: true,
        message: "You have joined the team.",
        membership: {
          team_id: invitation.team_id,
          team_name: team.team_name,
          role: member.role,
          joined_at: member.joined_at,
        },
      },
    };
  } catch (err) {
    if (err?.code === 11000) {
      const reactivated = await AtlasTeamMember.findOneAndUpdate(
        {
          team_id: invitation.team_id,
          user_id: invitation.invitee_user_id,
          status: "removed",
        },
        {
          $set: {
            status: "active",
            email: invitation.invitee_email,
            role: invitation.role,
            invited_by_user_id: invitation.inviter_user_id,
            invitation_id: String(invitation._id),
            joined_at: now,
          },
        },
        { new: true },
      );

      if (reactivated) {
        await refreshTeamMemberCount(invitation.team_id);
        return {
          ok: true,
          body: {
            success: true,
            message: "You have joined the team.",
            membership: {
              team_id: invitation.team_id,
              team_name: team.team_name,
              role: reactivated.role,
              joined_at: reactivated.joined_at,
            },
          },
        };
      }

      const activeMember = await AtlasTeamMember.findOne({
        team_id: invitation.team_id,
        user_id: invitation.invitee_user_id,
        status: "active",
      }).lean();

      if (activeMember) {
        return {
          ok: true,
          body: {
            success: true,
            message: "You are already a member of this team.",
            membership: {
              team_id: invitation.team_id,
              team_name: team.team_name,
              role: activeMember.role,
              joined_at: activeMember.joined_at,
            },
          },
        };
      }
    }

    lockedInvitation.status = "pending";
    lockedInvitation.responded_at = null;
    await lockedInvitation.save();

    console.error("Failed to accept team invitation:", err);
    return {
      ok: false,
      body: {
        success: false,
        message: "Unable to process invitation.",
      },
    };
  }
};

const formatListMemberRow = (user, member) => ({
  user_id: String(member.user_id),
  email: member.email,
  first_name: user?.first_name || "",
  last_name: user?.last_name || "",
  profile_image_url: user?.profile_image_url || null,
  role: member.role,
  status: member.status,
  joined_at: member.joined_at,
});

const buildOwnerListRow = (team, ownerUser) => ({
  user_id: String(team.owner_user_id),
  email: ownerUser?.email || team.owner_email || "",
  first_name: ownerUser?.first_name || "",
  last_name: ownerUser?.last_name || "",
  profile_image_url: ownerUser?.profile_image_url || null,
  role: TEAM_OWNER_ROLE,
  status: "active",
  joined_at: team.createdAt || null,
});

const listTeamMembers = async ({
  userId,
  teamId,
  page = 1,
  limit = 50,
  status = "active",
}) => {
  const permission = await checkTeamPermission(
    userId,
    teamId,
    TEAM_ACTIONS.LIST_MEMBERS,
  );

  if (!permission.allowed) {
    return {
      ok: false,
      statusCode: permission.statusCode,
      body: {
        success: false,
        message: permission.message,
      },
    };
  }

  const team = permission.team;
  const includeOwner = status === "active";

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (safePage - 1) * safeLimit;

  const filter = {
    team_id: String(team._id),
    status,
  };

  const [invitedMemberTotal, capacity] = await Promise.all([
    AtlasTeamMember.countDocuments(filter),
    getTeamCapacitySnapshot(permission.ownerUserId, team._id),
  ]);

  const total = includeOwner ? invitedMemberTotal + 1 : invitedMemberTotal;

  let memberSkip = skip;
  let memberLimit = safeLimit;
  let includeOwnerOnPage = false;

  if (includeOwner) {
    if (skip === 0) {
      includeOwnerOnPage = true;
      memberSkip = 0;
      memberLimit = Math.max(0, safeLimit - 1);
    } else {
      memberSkip = skip - 1;
      memberLimit = safeLimit;
    }
  }

  const members = await AtlasTeamMember.find(filter)
    .sort({ joined_at: -1 })
    .skip(memberSkip)
    .limit(memberLimit)
    .lean();

  const userIds = [
    ...(includeOwnerOnPage ? [String(team.owner_user_id)] : []),
    ...members.map((member) => member.user_id),
  ];

  const users = userIds.length
    ? await ElysiumAtlasUser.find({ _id: { $in: userIds } }).lean()
    : [];
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  const memberRows = members.map((member) =>
    formatListMemberRow(usersById.get(member.user_id), member),
  );

  const listMembers = includeOwnerOnPage
    ? [buildOwnerListRow(team, usersById.get(String(team.owner_user_id))), ...memberRows]
    : memberRows;

  return {
    ok: true,
    statusCode: 200,
    body: {
      success: true,
      team_id: String(team._id),
      current_team_size: capacity.memberCount,
      max_team_members: capacity.maxTeamMembers,
      page: safePage,
      limit: safeLimit,
      total,
      members: listMembers,
    },
  };
};

const removeTeamMember = async ({ userId, teamId, memberUserId }) => {
  if (!memberUserId) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: "user_id is required.",
      },
    };
  }

  const permission = await checkTeamPermission(
    userId,
    teamId,
    TEAM_ACTIONS.REMOVE_MEMBERS,
  );

  if (!permission.allowed) {
    return {
      ok: false,
      statusCode: permission.statusCode,
      body: {
        success: false,
        message: permission.message,
      },
    };
  }

  const team = permission.team;
  const memberIdStr = String(memberUserId);

  if (memberIdStr === String(permission.ownerUserId)) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: "The team owner cannot be removed.",
      },
    };
  }

  const member = await AtlasTeamMember.findOneAndUpdate(
    {
      team_id: String(team._id),
      user_id: memberIdStr,
      status: "active",
    },
    { $set: { status: "removed" } },
    { new: true },
  ).lean();

  if (!member) {
    const existing = await AtlasTeamMember.findOne({
      team_id: String(team._id),
      user_id: memberIdStr,
    }).lean();

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        body: {
          success: false,
          message: "This user is not a member of your team.",
        },
      };
    }

    return {
      ok: false,
      statusCode: 200,
      body: {
        success: false,
        message: "This member has already been removed.",
        member: {
          user_id: existing.user_id,
          email: existing.email,
          status: existing.status,
        },
      },
    };
  }

  await refreshTeamMemberCount(team._id);

  return {
    ok: true,
    statusCode: 200,
    body: {
      success: true,
      message: "Team member removed.",
      member: {
        user_id: member.user_id,
        email: member.email,
        role: member.role,
        status: member.status,
      },
    },
  };
};

const updateTeamMemberRole = async ({ userId, teamId, memberUserId, role }) => {
  if (!memberUserId) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: "user_id is required.",
      },
    };
  }

  if (!role) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: "role is required.",
      },
    };
  }

  if (!INVITABLE_ROLES.includes(role)) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: 'Invalid role. Must be "admin" or "member".',
      },
    };
  }

  const permission = await checkTeamPermission(
    userId,
    teamId,
    TEAM_ACTIONS.UPDATE_MEMBER_ROLE,
  );

  if (!permission.allowed) {
    return {
      ok: false,
      statusCode: permission.statusCode,
      body: {
        success: false,
        message: permission.message,
      },
    };
  }

  const team = permission.team;
  const memberIdStr = String(memberUserId);

  if (memberIdStr === String(permission.ownerUserId)) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        success: false,
        message: "The team owner's role cannot be changed.",
      },
    };
  }

  const member = await AtlasTeamMember.findOneAndUpdate(
    {
      team_id: String(team._id),
      user_id: memberIdStr,
      status: "active",
    },
    { $set: { role } },
    { new: true },
  ).lean();

  if (!member) {
    const existing = await AtlasTeamMember.findOne({
      team_id: String(team._id),
      user_id: memberIdStr,
    }).lean();

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        body: {
          success: false,
          message: "This user is not a member of your team.",
        },
      };
    }

    return {
      ok: false,
      statusCode: 200,
      body: {
        success: false,
        message: "This member has been removed.",
        member: {
          user_id: existing.user_id,
          email: existing.email,
          role: existing.role,
          status: existing.status,
        },
      },
    };
  }

  return {
    ok: true,
    statusCode: 200,
    body: {
      success: true,
      message: "Team member role updated.",
      member: {
        user_id: member.user_id,
        email: member.email,
        role: member.role,
        status: member.status,
      },
    },
  };
};

module.exports = {
  inviteTeamMembers,
  getInvitationPreview,
  respondToInvitation,
  listTeamMembers,
  removeTeamMember,
  updateTeamMemberRole,
};
