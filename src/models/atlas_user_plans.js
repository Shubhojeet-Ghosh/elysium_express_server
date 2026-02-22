const mongoose = require("mongoose");

/**
 * atlas_user_plans collection
 *
 * Tracks each user's active/historical plan subscriptions.
 * One document = one plan assignment for a user (supports plan history via multiple docs).
 */
const atlasUserPlanSchema = new mongoose.Schema(
  {
    // --- Core identifiers ---
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    plan_id: {
      type: String,
      required: true,
      trim: true,
      // e.g. "free", "pro_monthly", "enterprise_yearly"
    },
    plan_name: {
      type: String,
      trim: true,
      // Denormalized for fast reads — avoids a join to a plans collection
    },

    // --- Status ---
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
        "paused",
      ],
      default: "active",
      index: true,
      // "past_due"  → payment failed, grace period active
      // "paused"    → user-initiated pause (if your plans support it)
    },

    // --- Billing cycle ---
    billing_cycle: {
      type: String,
      enum: ["trial", "monthly", "quarterly", "yearly", "lifetime", "custom"],
      default: "monthly",
    },

    // --- Lifecycle dates ---
    started_at: {
      type: Date,
      default: Date.now,
      // When this plan period began
    },
    expires_at: {
      type: Date,
      default: null,
      // null = lifetime / no expiry; set for all time-boxed plans
    },
    trial_ends_at: {
      type: Date,
      default: null,
      // Populated only when billing_cycle === "trial"
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
    cancel_reason: {
      type: String,
      default: null,
      trim: true,
      // User-supplied or system-generated cancellation reason
    },

    // --- Payment / billing integration ---
    payment_provider: {
      type: String,
      enum: ["stripe", "razorpay", "paddle", "manual", "none"],
      default: "none",
    },
    payment_subscription_id: {
      type: String,
      default: null,
      trim: true,
      // External subscription ID from the payment provider (e.g. Stripe sub_xxx)
    },
    payment_customer_id: {
      type: String,
      default: null,
      trim: true,
      // External customer ID from the payment provider (e.g. Stripe cus_xxx)
    },
    last_payment_at: {
      type: Date,
      default: null,
    },
    next_billing_at: {
      type: Date,
      default: null,
    },
    payment_amount: {
      type: Number,
      default: 0,
    },

    // --- Audit / metadata ---
    notes: {
      type: String,
      default: null,
      trim: true,
      // Internal admin notes (e.g. "Gifted 3-month pro trial by support team")
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt in ISODate format (2026-01-01T15:08:39.600+00:00)
    collection: "atlas_user_plans",
  },
);

// --- Compound indexes for common query patterns ---

// Quickly look up a user's active plan
atlasUserPlanSchema.index({ user_id: 1, is_active: 1 });

// Find all plans expiring soon (for renewal reminders / cron jobs)
atlasUserPlanSchema.index({ expires_at: 1, is_active: 1 });

// Look up by external payment subscription (for webhook handlers)
atlasUserPlanSchema.index({ payment_subscription_id: 1 }, { sparse: true });

const AtlasUserPlan = mongoose.model("AtlasUserPlan", atlasUserPlanSchema);

module.exports = AtlasUserPlan;
