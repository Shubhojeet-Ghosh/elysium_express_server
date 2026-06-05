const AtlasTeam = require("../models/atlas_teams");
const AtlasUserAvailablePlanLimits = require("../models/atlas_user_available_plan_limits");
const {
  DEFAULT_MAX_TEAM_MEMBERS,
  resolveMaxTeamMembers,
} = require("../utils/planLimitDefaults");

/**
 * Sets max_members on the user's owned team from plan_limits.max_team_members.
 */
const syncTeamMaxMembers = async (user_id, maxTeamMembers) => {
  const maxMembers = maxTeamMembers ?? DEFAULT_MAX_TEAM_MEMBERS;

  await AtlasTeam.findOneAndUpdate(
    { owner_user_id: String(user_id) },
    { $set: { max_members: maxMembers } },
  );
};

/**
 * Reads max_team_members from the user's available limits doc (with defaults).
 */
const syncTeamMaxMembersFromUserLimits = async (user_id) => {
  const limitsDoc = await AtlasUserAvailablePlanLimits.findOne({
    user_id: String(user_id),
  }).lean();

  const maxMembers = limitsDoc
    ? resolveMaxTeamMembers(limitsDoc)
    : DEFAULT_MAX_TEAM_MEMBERS;

  await syncTeamMaxMembers(user_id, maxMembers);
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

  await syncTeamMaxMembersFromUserLimits(ownerIdStr);

  return AtlasTeam.findOne({ owner_user_id: ownerIdStr });
};

module.exports = {
  ensureTeam,
  syncTeamMaxMembers,
  syncTeamMaxMembersFromUserLimits,
};
