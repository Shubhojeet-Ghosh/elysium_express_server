const AtlasTeam = require("../models/atlas_teams");

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

module.exports = { ensureTeam };
