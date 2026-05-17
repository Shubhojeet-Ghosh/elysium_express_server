const mongoose = require("mongoose");

/**
 * atlas_user_usage collection
 *
 * Tracks actual resource consumption for a user within a specific plan period.
 * One document = one user's usage for one plan period (linked to atlas_user_plans).
 *
 * The counter fields (e.g. ai_queries, training_urls_allowed, etc.) are
 * dynamically seeded from the corresponding atlas_plans.plan_limits keys so
 * the schema stays flexible as plans evolve.
 *
 * strict: false  →  allows Mongoose to persist any extra keys that aren't
 *                    explicitly declared in the schema.
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
