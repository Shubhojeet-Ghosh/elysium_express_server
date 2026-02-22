const AtlasUserPlan = require("../models/atlas_user_plans");
const AtlasPlan = require("../models/atlas_plans");
const AtlasUserAvailablePlanLimits = require("../models/atlas_user_available_plan_limits");

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

/**
 * Fetch the available (remaining) limits for a user from atlas_user_available_plan_limits.
 * Picks only the known limit keys; extra keys stored via strict:false are included via lean().
 */
const AVAILABLE_LIMIT_KEYS = [
  "ai_agents",
  "ai_queries",
  "max_file_size_mb",
  "max_files",
  "models_allowed",
  "rate_limit_per_minute",
  "training_urls_allowed",
];

const getAvailableLimitsByUserId = async (user_id) => {
  const doc = await AtlasUserAvailablePlanLimits.findOne({
    user_id: String(user_id),
  }).lean();

  if (!doc) return null;

  const limits = {};
  for (const key of AVAILABLE_LIMIT_KEYS) {
    if (doc[key] !== undefined) {
      limits[key] = doc[key];
    }
  }
  return limits;
};

/**
 * Aggregate full plan info for a user in one call.
 * Returns:
 *  - plan         : fields from atlas_user_plans
 *  - original_limits : plan_limits from atlas_plans
 *  - available_limits: current remaining values from atlas_user_available_plan_limits
 */
const getFullUserPlanInfo = async (user_id) => {
  const uid = String(user_id);

  const userPlan = await getUserPlanByUserId(uid);
  if (!userPlan) return null;

  const [planDefinition, availableLimits] = await Promise.all([
    getPlanDefinitionByPlanId(userPlan.plan_id),
    getAvailableLimitsByUserId(uid),
  ]);

  return {
    plan: userPlan,
    original_limits: planDefinition?.plan_limits || null,
    available_limits: availableLimits || null,
  };
};

module.exports = {
  getUserPlanByUserId,
  getPlanDefinitionByPlanId,
  getAvailableLimitsByUserId,
  getFullUserPlanInfo,
};
