const AtlasTeam = require("../models/atlas_teams");
const { getUserRoleForTeam } = require("./atlasTeamService");
const {
  TEAM_ACTIONS,
  ROLE_PERMISSIONS,
  ACTION_DENIED_MESSAGES,
} = require("../constants/atlasTeamPermissionConstants");

const loadActiveTeam = async (teamId) => {
  if (!teamId) {
    return null;
  }

  return AtlasTeam.findOne({
    _id: teamId,
    is_active: true,
    status: "active",
  }).lean();
};

const canPerformTeamAction = (role, action) =>
  Boolean(role && ROLE_PERMISSIONS[role]?.includes(action));

/**
 * Resolves the caller's role for a team (owner | admin | member).
 * Authorization is scoped to team_id, not whether the user owns the team.
 */
const resolveTeamAccess = async (userId, teamId) => {
  if (!teamId) {
    return {
      ok: false,
      statusCode: 400,
      message: "Team ID is missing from session.",
    };
  }

  const team = await loadActiveTeam(teamId);
  if (!team) {
    return {
      ok: false,
      statusCode: 403,
      message: "Team not found or inactive.",
    };
  }

  const role = await getUserRoleForTeam(userId, teamId);
  if (!role) {
    return {
      ok: false,
      statusCode: 403,
      message: "You are not a member of this team.",
    };
  }

  return {
    ok: true,
    team,
    role,
    ownerUserId: team.owner_user_id,
  };
};

/**
 * Returns whether the user may perform action on teamId.
 * On success: { allowed: true, team, role, ownerUserId }
 * On failure: { allowed: false, statusCode, message }
 */
const checkTeamPermission = async (userId, teamId, action) => {
  const access = await resolveTeamAccess(userId, teamId);

  if (!access.ok) {
    return {
      allowed: false,
      statusCode: access.statusCode,
      message: access.message,
    };
  }

  if (!canPerformTeamAction(access.role, action)) {
    return {
      allowed: false,
      statusCode: 403,
      message:
        ACTION_DENIED_MESSAGES[action] ||
        "You do not have permission for this action.",
      role: access.role,
    };
  }

  return {
    allowed: true,
    team: access.team,
    role: access.role,
    ownerUserId: access.ownerUserId,
  };
};

module.exports = {
  TEAM_ACTIONS,
  loadActiveTeam,
  canPerformTeamAction,
  resolveTeamAccess,
  checkTeamPermission,
};
