const AtlasUserPlan = require("../models/atlas_user_plans");
const AtlasPlan = require("../models/atlas_plans");
const AtlasUserAvailablePlanLimits = require("../models/atlas_user_available_plan_limits");

const STARTER_PLAN_ID = "starter-001";

/**
 * Ensures a user has at least one plan entry.
 *
 * - New users  → called right after account creation.
 * - Old users  → called on every login; if no plan record exists at all
 *               (pre-plan-integration accounts) a 7-day trial is granted
 *               starting from today.
 *
 * The function is idempotent: if any plan record already exists (active or
 * historic), it does nothing.
 *
 * @param {mongoose.Types.ObjectId | string} user_id  Coerced to string before storage.
 * @param {string} [notes]  Optional audit note stored on the plan document.
 * @returns {Promise<{ created: boolean, plan: object | null }>}
 */
const ensureTrialPlan = async (user_id, notes = "") => {
  try {
    const uid = String(user_id);
    const existing = await AtlasUserPlan.findOne({ user_id: uid }).lean();

    // User already has a plan record — but check if limits doc is missing (e.g. pre-limits-integration accounts).
    if (existing) {
      const limitsDoc = await AtlasUserAvailablePlanLimits.findOne({
        user_id: uid,
      }).lean();
      if (!limitsDoc) {
        const existingPlanDoc = await AtlasPlan.findOne({
          plan_id: existing.plan_id,
        }).lean();
        const existingPlanLimits = existingPlanDoc?.plan_limits || {};
        await AtlasUserAvailablePlanLimits.findOneAndUpdate(
          { user_id: uid },
          {
            $setOnInsert: {
              user_id: uid,
              ...existingPlanLimits,
            },
          },
          { upsert: true, new: true },
        );
      }
      return { created: false, plan: null };
    }

    // Fetch plan metadata from atlas_plans collection.
    const planDoc = await AtlasPlan.findOne({
      plan_id: STARTER_PLAN_ID,
    }).lean();
    const planName = planDoc?.plan_name || STARTER_PLAN_ID;

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const plan = await AtlasUserPlan.create({
      user_id: uid,
      plan_id: STARTER_PLAN_ID,
      plan_name: planName,
      is_active: true,
      status: "trialing",
      billing_cycle: "trial",
      started_at: now,
      expires_at: trialEndsAt,
      trial_ends_at: trialEndsAt,
      payment_provider: "none",
      notes:
        notes || "Auto-assigned 7-day trial on account creation / first login.",
    });

    // Build usage counters dynamically from plan_limits — store values exactly as defined in atlas_plans.
    const planLimits = planDoc?.plan_limits || {};
    const usageCounters = { ...planLimits };

    // Create the usage tracking doc for this plan period (if not already exists).
    await AtlasUserAvailablePlanLimits.findOneAndUpdate(
      { user_id: uid },
      {
        $setOnInsert: {
          user_id: uid,
          ...usageCounters,
        },
      },
      { upsert: true, new: true },
    );

    return { created: true, plan };
  } catch (err) {
    // Non-fatal — log and swallow so a plan DB issue never breaks auth.
    console.error("[ensureTrialPlan] Failed to assign trial plan:", err);
    return { created: false, plan: null };
  }
};

module.exports = { ensureTrialPlan };
