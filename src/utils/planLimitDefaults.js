const DEFAULT_MAX_VISITOR_MESSAGE_CHARS = 4000;

/**
 * Fills in legacy-missing plan limit fields. Does not override explicit values.
 */
const applyPlanLimitDefaults = (planLimits = {}) => {
  const limits = { ...planLimits };

  if (limits.max_visitor_message_chars == null) {
    limits.max_visitor_message_chars = DEFAULT_MAX_VISITOR_MESSAGE_CHARS;
  }

  return limits;
};

module.exports = {
  DEFAULT_MAX_VISITOR_MESSAGE_CHARS,
  applyPlanLimitDefaults,
};
