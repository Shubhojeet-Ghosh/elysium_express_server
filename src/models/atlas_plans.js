const mongoose = require("mongoose");

/**
 * atlas_plans collection
 *
 * Master list of available plans for Elysium Atlas.
 * plan_id is set manually in the DB (e.g. "starter-ai", "pro", "enterprise").
 */
const atlasPlansSchema = new mongoose.Schema(
  {
    plan_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Set manually in the collection — e.g. "starter-ai", "pro_monthly"
    },
    plan_name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Starter AI"
    },
    plan_limits: {
      type: Object,
      default: null,
      // Populate later with resource limits, e.g.:
      // { api_calls: 1000, messages: 500, storage_mb: 100 }
    },
    validity_days: {
      type: Number,
      default: null,
      // Number of days this plan is valid for from the start date.
      // null = lifetime / no expiry.
    },
  },
  {
    timestamps: true,
    collection: "atlas_plans",
  },
);

const AtlasPlan = mongoose.model("AtlasPlan", atlasPlansSchema);

module.exports = AtlasPlan;
