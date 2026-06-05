const DEFAULT_MAX_VISITOR_MESSAGE_CHARS = 4000;
const DEFAULT_MAX_TEAM_MEMBERS = 1;

/**
 * Fills in legacy-missing plan limit fields. Does not override explicit values.
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

const resolveMaxTeamMembers = (planLimits = {}) =>
  applyPlanLimitDefaults(planLimits).max_team_members;

module.exports = {
  DEFAULT_MAX_VISITOR_MESSAGE_CHARS,
  DEFAULT_MAX_TEAM_MEMBERS,
  applyPlanLimitDefaults,
  resolveMaxTeamMembers,
};
