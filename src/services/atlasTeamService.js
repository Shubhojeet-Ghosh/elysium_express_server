const AtlasTeam = require("../models/atlas_teams");
const AtlasTeamMember = require("../models/atlas_team_members");
const { DEFAULT_MAX_TEAM_MEMBERS } = require("../utils/planLimitDefaults");
const { TEAM_OWNER_ROLE } = require("../constants/atlasTeamRoleConstants");

const countActiveTeamMembers = async (teamId) =>
  AtlasTeamMember.countDocuments({
    team_id: String(teamId),
    status: "active",
  });

/**
 * Recomputes member_count on atlas_teams: 1 (owner) + active accepted members.
 */
const refreshTeamMemberCount = async (teamId) => {
  const activeMembers = await countActiveTeamMembers(teamId);
  const member_count = 1 + activeMembers;

  return AtlasTeam.findByIdAndUpdate(
    teamId,
    { $set: { member_count } },
    { new: true },
  ).lean();
};

const getOwnerTeamByUserId = async (user_id) =>
  AtlasTeam.findOne({
    owner_user_id: String(user_id),
    is_active: true,
    status: "active",
  }).lean();

/**
 * Team capacity from atlas_teams — refreshes member_count before returning.
 */
const getOwnerTeamLimits = async (user_id) => {
  const team = await getOwnerTeamByUserId(user_id);
  if (!team) return null;

  return getTeamLimits(team._id);
};

/**
 * Team capacity for a specific team_id (session active team).
 */
const getTeamLimits = async (teamId) => {
  if (!teamId) {
    return null;
  }

  const team = await AtlasTeam.findOne({
    _id: teamId,
    is_active: true,
    status: "active",
  }).lean();

  if (!team) {
    return null;
  }

  const refreshed = await refreshTeamMemberCount(teamId);
  if (!refreshed) {
    return null;
  }

  return {
    team_id: String(refreshed._id),
    owner_user_id: String(refreshed.owner_user_id),
    max_team_members: refreshed.max_members,
    member_count: refreshed.member_count,
  };
};

const getOwnerMaxTeamMembers = async (user_id) => {
  const team = await getOwnerTeamByUserId(user_id);
  return team?.max_members ?? DEFAULT_MAX_TEAM_MEMBERS;
};

/**
 * Finds the team owned by the given user, or creates one if it doesn't exist.
 * Call this on every login / sign-up path so the response always carries team_id.
 *
 * @param {string|ObjectId} user_id    - The user's _id
 * @param {string}          teamName   - Fallback name (usually first_name)
 * @param {string}          ownerEmail - The user's email address
 * @returns {Promise<AtlasTeam>}
 */
const ensureTeam = async (user_id, teamName, ownerEmail) => {
  const ownerIdStr = String(user_id);

  let team = await AtlasTeam.findOne({ owner_user_id: ownerIdStr });

  if (!team) {
    const resolvedName =
      teamName?.trim() || ownerEmail?.toLowerCase().trim() || null;
    team = await AtlasTeam.create({
      owner_user_id: ownerIdStr,
      owner_email: ownerEmail?.toLowerCase().trim() || null,
      team_name: resolvedName,
    });
  }

  return team;
};

/**
 * All teams the user belongs to — owned teams and teams they joined as a member.
 */
const getUserTeams = async (user_id) => {
  const uid = String(user_id);

  const [ownedTeams, memberships] = await Promise.all([
    AtlasTeam.find({
      owner_user_id: uid,
      is_active: true,
      status: "active",
    }).lean(),
    AtlasTeamMember.find({ user_id: uid, status: "active" }).lean(),
  ]);

  const ownedIds = new Set(ownedTeams.map((team) => String(team._id)));
  const membershipByTeamId = new Map(
    memberships.map((membership) => [membership.team_id, membership]),
  );
  const memberTeamIds = [
    ...new Set(
      memberships
        .map((membership) => membership.team_id)
        .filter((teamId) => !ownedIds.has(teamId)),
    ),
  ];

  const memberTeams = memberTeamIds.length
    ? await AtlasTeam.find({
        _id: { $in: memberTeamIds },
        is_active: true,
        status: "active",
      }).lean()
    : [];

  const formatTeam = (team, role) => ({
    team_id: String(team._id),
    team_name: team.team_name || null,
    is_owner: role === TEAM_OWNER_ROLE,
    role,
  });

  return [
    ...ownedTeams.map((team) => formatTeam(team, TEAM_OWNER_ROLE)),
    ...memberTeams.map((team) => {
      const membership = membershipByTeamId.get(String(team._id));
      return formatTeam(team, membership?.role || "member");
    }),
  ];
};

/**
 * Resolves the user's role for a specific team: owner | admin | member.
 */
const getUserRoleForTeam = async (userId, teamId) => {
  if (!teamId) {
    return null;
  }

  const uid = String(userId);
  const tid = String(teamId);

  const owned = await AtlasTeam.exists({
    _id: tid,
    owner_user_id: uid,
    is_active: true,
    status: "active",
  });

  if (owned) {
    return TEAM_OWNER_ROLE;
  }

  const membership = await AtlasTeamMember.findOne({
    team_id: tid,
    user_id: uid,
    status: "active",
  }).lean();

  return membership?.role ?? null;
};

module.exports = {
  ensureTeam,
  getUserTeams,
  getUserRoleForTeam,
  refreshTeamMemberCount,
  getOwnerTeamLimits,
  getTeamLimits,
  getOwnerMaxTeamMembers,
};
