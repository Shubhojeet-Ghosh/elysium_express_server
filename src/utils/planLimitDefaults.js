const DEFAULT_MAX_VISITOR_MESSAGE_CHARS = 4000;
const DEFAULT_MAX_TEAM_MEMBERS = 1;

/** Capacity keys — never written to atlas_user_available_plan_limits. */
const PLAN_CAPACITY_LIMIT_KEYS = ["max_team_members"];

/**
 * Fills in legacy-missing plan limit fields for atlas_plans / original_limits.
 * Does not override explicit values.
 */
const applyPlanLimitDefaults = (planLimits = {}) => {
  const limits = { ...planLimits };

  if (limits.max_visitor_message_chars == null) {
    limits.max_visitor_message_chars = DEFAULT_MAX_VISITOR_MESSAGE_CHARS;
  }

  if (limits.max_team_members == null) {
    limits.max_team_members = DEFAULT_MAX_TEAM_MEMBERS;
  }

  return limits;
};

/**
 * Defaults for consumable limits on atlas_user_available_plan_limits.
 * Capacity limits (e.g. max_team_members) are excluded.
 */
const applyAvailableLimitDefaults = (planLimits = {}) => {
  const limits = { ...planLimits };

  for (const key of PLAN_CAPACITY_LIMIT_KEYS) {
    delete limits[key];
  }

  if (limits.max_visitor_message_chars == null) {
    limits.max_visitor_message_chars = DEFAULT_MAX_VISITOR_MESSAGE_CHARS;
  }

  return limits;
};

const resolveMaxTeamMembers = (planLimits = {}) =>
  applyPlanLimitDefaults(planLimits).max_team_members;

module.exports = {
  DEFAULT_MAX_VISITOR_MESSAGE_CHARS,
  DEFAULT_MAX_TEAM_MEMBERS,
  PLAN_CAPACITY_LIMIT_KEYS,
  applyPlanLimitDefaults,
  applyAvailableLimitDefaults,
  resolveMaxTeamMembers,
};
