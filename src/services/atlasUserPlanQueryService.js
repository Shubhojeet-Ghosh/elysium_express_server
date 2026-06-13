const AtlasUserPlan = require("../models/atlas_user_plans");
const AtlasPlan = require("../models/atlas_plans");
const AtlasUserAvailablePlanLimits = require("../models/atlas_user_available_plan_limits");
const {
  applyPlanLimitDefaults,
  applyAvailableLimitDefaults,
  PLAN_CAPACITY_LIMIT_KEYS,
  DEFAULT_MAX_TEAM_MEMBERS,
} = require("../utils/planLimitDefaults");
const { getTeamLimits, getOwnerTeamLimits, getOwnerMaxTeamMembers } =
  require("./atlasTeamService");

// ---------------------------------------------------------------------------
// Granular query helpers — each fetches exactly one piece of data.
// Compose these in controllers / other services as needed.
// ---------------------------------------------------------------------------

/**
 * Fetch the active (or latest) user plan for a given user_id.
 * Returns selected fields only.
 */
const getUserPlanByUserId = async (user_id) => {
  return AtlasUserPlan.findOne({ user_id: String(user_id), is_active: true })
    .select(
      "plan_id plan_name is_active status billing_cycle expires_at trial_ends_at notes",
    )
    .lean();
};

/**
 * Fetch the original plan definition (including plan_limits) from atlas_plans
 * for a given plan_id.
 */
const getPlanDefinitionByPlanId = async (plan_id) => {
  return AtlasPlan.findOne({ plan_id })
    .select("plan_id plan_name plan_limits")
    .lean();
};

const LIMITS_DOC_METADATA_KEYS = new Set([
  "_id",
  "user_id",
  "__v",
  "createdAt",
  "updatedAt",
]);

/**
 * Fetch the available (remaining) limits for a user from atlas_user_available_plan_limits.
 * Returns every limit field on the doc (e.g. max_visitor_message_chars) — not a fixed whitelist.
 */
const getAvailableLimitsByUserId = async (user_id) => {
  const doc = await AtlasUserAvailablePlanLimits.findOne({
    user_id: String(user_id),
  }).lean();

  if (!doc) return null;

  const limits = {};
  const capacityKeys = new Set(PLAN_CAPACITY_LIMIT_KEYS);
  for (const [key, value] of Object.entries(doc)) {
    if (!LIMITS_DOC_METADATA_KEYS.has(key) && !capacityKeys.has(key)) {
      limits[key] = value;
    }
  }
  return applyAvailableLimitDefaults(limits);
};

/**
 * max_team_members for a team — from atlas_teams.max_members.
 */
const getPlanMaxTeamMembersForTeam = async (team_id) => {
  const teamLimits = await getTeamLimits(team_id);
  return teamLimits?.max_team_members ?? DEFAULT_MAX_TEAM_MEMBERS;
};

/**
 * @deprecated Use getPlanMaxTeamMembersForTeam(team_id) or getOwnerMaxTeamMembers(owner_user_id).
 */
const getPlanMaxTeamMembersForUser = async (user_id) =>
  getOwnerMaxTeamMembers(user_id);

/**
 * Aggregate full plan info for the team in the session (owner's plan + team capacity).
 */
const getFullTeamPlanInfo = async (team_id) => {
  const teamLimits = await getTeamLimits(team_id);
  if (!teamLimits) {
    return null;
  }

  const ownerUserId = teamLimits.owner_user_id;
  const userPlan = await getUserPlanByUserId(ownerUserId);
  if (!userPlan) {
    return null;
  }

  const [planDefinition, availableLimits] = await Promise.all([
    getPlanDefinitionByPlanId(userPlan.plan_id),
    getAvailableLimitsByUserId(ownerUserId),
  ]);

  const originalLimits = planDefinition
    ? applyPlanLimitDefaults(planDefinition.plan_limits || {})
    : null;

  if (originalLimits) {
    originalLimits.max_team_members = teamLimits.max_team_members;
    originalLimits.member_count = teamLimits.member_count;
  }

  return {
    plan: userPlan,
    original_limits: originalLimits,
    available_limits: availableLimits,
    team: {
      team_id: teamLimits.team_id,
      max_team_members: teamLimits.max_team_members,
      member_count: teamLimits.member_count,
    },
  };
};

/**
 * @deprecated Use getFullTeamPlanInfo(team_id).
 */
const getFullUserPlanInfo = async (user_id) => {
  const teamLimits = await getOwnerTeamLimits(user_id);
  if (!teamLimits?.team_id) {
    return null;
  }
  return getFullTeamPlanInfo(teamLimits.team_id);
};

module.exports = {
  getUserPlanByUserId,
  getPlanDefinitionByPlanId,
  getAvailableLimitsByUserId,
  getFullTeamPlanInfo,
  getFullUserPlanInfo,
  getPlanMaxTeamMembersForTeam,
  getPlanMaxTeamMembersForUser,
};
