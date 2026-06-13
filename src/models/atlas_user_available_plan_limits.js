const mongoose = require("mongoose");

/**
 * atlas_user_available_plan_limits collection
 *
 * Per-user remaining consumable limits (e.g. ai_queries, max_visitor_message_chars).
 * Seeded/updated on plan assign and trial provisioning via syncUserAvailableLimits.
 *
 * Does NOT store team capacity — no max_team_members. Team size limits live on
 * atlas_teams.max_members only. Legacy docs may still contain max_team_members;
 * it is stripped on the next plan sync ($unset) and omitted from API responses.
 *
 * strict: false → allows dynamic plan_limits keys as plans evolve.
 */
const atlasUserUsageSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    strict: false, // allows dynamic plan_limits keys to be stored
    timestamps: true,
    collection: "atlas_user_available_plan_limits",
  },
);

const AtlasUserAvailablePlanLimits = mongoose.model(
  "AtlasUserAvailablePlanLimits",
  atlasUserUsageSchema,
);

module.exports = AtlasUserAvailablePlanLimits;
