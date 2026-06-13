const { generateJwtToken, verifyJwtToken } = require("./jwtService");
const { getUserTeams } = require("./atlasTeamService");
const {
  SELECTION_TOKEN_TYPE,
  SELECTION_TOKEN_TTL,
} = require("../constants/atlasTeamSelectionConstants");

const ElysiumAtlasUser = require("../models/elysium_atlas_users");

const formatAuthUser = (user, teamId = null, role = null) => ({
  user_id: user._id,
  team_id: teamId != null ? String(teamId) : null,
  role: role ?? null,
  email: user.email,
  first_name: user.first_name || "",
  last_name: user.last_name || "",
  profile_image_url: user?.profile_image_url || null,
});

const buildSelectionToken = (user) =>
  generateJwtToken(
    {
      type: SELECTION_TOKEN_TYPE,
      user_id: String(user._id),
      email: user.email,
    },
    SELECTION_TOKEN_TTL,
  );

const verifySelectionToken = (token) => {
  const decoded = verifyJwtToken(token);
  if (!decoded || decoded.type !== SELECTION_TOKEN_TYPE || !decoded.user_id) {
    return null;
  }
  return decoded;
};

const buildSessionToken = (user, teamId, role, extraClaims = {}) =>
  generateJwtToken(
    {
      user_id: user._id,
      email: user.email,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      is_profile_complete: user.is_profile_complete,
      team_id: String(teamId),
      role,
      ...extraClaims,
    },
    "30d",
  );

/**
 * After identity is verified: either issue a session (1 team) or ask for team selection.
 */
const buildPostAuthResponse = async (
  user,
  { message = "Login successful.", source = null } = {},
) => {
  const teams = await getUserTeams(user._id);

  if (teams.length > 1) {
    return {
      statusCode: 200,
      body: {
        success: true,
        requires_team_selection: true,
        message: "Select a team to continue.",
        selection_token: buildSelectionToken(user),
        is_profile_complete: user.is_profile_complete,
        teams,
        user: formatAuthUser(user, null, null),
      },
    };
  }

  const activeTeam = teams[0] ?? null;
  const activeTeamId = activeTeam?.team_id ?? null;
  const role = activeTeam?.role ?? null;
  const extraClaims = source ? { source } : {};

  return {
    statusCode: 200,
    body: {
      success: true,
      message,
      is_profile_complete: user.is_profile_complete,
      sessionToken: buildSessionToken(user, activeTeamId, role, extraClaims),
      teams,
      user: formatAuthUser(user, activeTeamId, role),
    },
  };
};

const selectTeamAndIssueSession = async (selectionToken, teamId) => {
  if (!selectionToken) {
    return {
      statusCode: 400,
      body: { success: false, message: "selection_token is required." },
    };
  }

  if (!teamId) {
    return {
      statusCode: 400,
      body: { success: false, message: "team_id is required." },
    };
  }

  const decoded = verifySelectionToken(selectionToken);
  if (!decoded) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: "Invalid or expired selection token.",
      },
    };
  }

  const user = await ElysiumAtlasUser.findById(decoded.user_id);
  if (!user) {
    return {
      statusCode: 404,
      body: { success: false, message: "User not found." },
    };
  }

  const teams = await getUserTeams(user._id);
  const chosenTeamId = String(teamId);
  const chosenTeam = teams.find((team) => team.team_id === chosenTeamId);

  if (!chosenTeam) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: "You do not belong to this team.",
      },
    };
  }

  const role = chosenTeam.role;

  return {
    statusCode: 200,
    body: {
      success: true,
      message: "Login successful.",
      is_profile_complete: user.is_profile_complete,
      sessionToken: buildSessionToken(user, chosenTeamId, role),
      teams,
      user: formatAuthUser(user, chosenTeamId, role),
    },
  };
};

module.exports = {
  buildPostAuthResponse,
  selectTeamAndIssueSession,
};
