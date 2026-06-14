const AtlasUserPlan = require("../models/atlas_user_plans");
const AtlasPlan = require("../models/atlas_plans");
const AtlasUserAvailablePlanLimits = require("../models/atlas_user_available_plan_limits");
const {
  applyAvailableLimitDefaults,
  PLAN_CAPACITY_LIMIT_KEYS,
  resolveMaxTeamMembers,
} = require("../utils/planLimitDefaults");
const { syncTeamMaxMembers } = require("./atlasTeamService");

const STARTER_PLAN_ID = "trial-001";

/**
 * Copies consumable plan limits onto the user's atlas_user_available_plan_limits
 * doc (e.g. max_visitor_message_chars, ai_queries). Never writes max_team_members
 * or other capacity keys — those live on atlas_teams only.
 */
const syncUserAvailableLimits = async (user_id, planLimits = {}) => {
  const uid = String(user_id);
  const limits = applyAvailableLimitDefaults(planLimits);

  const unsetCapacityFields = Object.fromEntries(
    PLAN_CAPACITY_LIMIT_KEYS.map((key) => [key, ""]),
  );

  await AtlasUserAvailablePlanLimits.findOneAndUpdate(
    { user_id: uid },
    { $set: limits, $unset: unsetCapacityFields },
    { upsert: true, new: true },
  );
};

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
        await syncUserAvailableLimits(
          uid,
          existingPlanDoc?.plan_limits || {},
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
    const validityDays = planDoc?.validity_days ?? 7;
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + validityDays);

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

    await syncUserAvailableLimits(uid, planDoc?.plan_limits || {});

    return { created: true, plan };
  } catch (err) {
    // Non-fatal — log and swallow so a plan DB issue never breaks auth.
    console.error("[ensureTrialPlan] Failed to assign trial plan:", err);
    return { created: false, plan: null };
  }
};

/**
 * Assigns a specific plan to a user.
 * - Deactivates all currently active plans for the user in atlas_user_plans.
 * - Creates a new plan document for the given plan_id.
 * - Updates (not replaces) the existing atlas_user_available_plan_limits doc
 *   for the user with the new plan's limits.
 *
 * @param {string} user_id
 * @param {string} plan_id  Must exist in atlas_plans collection.
 * @returns {Promise<{ success: boolean, plan: object | null, message: string }>}
 */
const assignPlanToUser = async (user_id, plan_id) => {
  const uid = String(user_id);

  // 1. Fetch plan definition.
  const planDoc = await AtlasPlan.findOne({ plan_id }).lean();
  if (!planDoc) {
    return {
      success: false,
      plan: null,
      message: `Plan '${plan_id}' not found.`,
    };
  }

  const now = new Date();
  const validityDays = planDoc.validity_days ?? 30;
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  // 2. Deactivate all currently active plans for this user.
  await AtlasUserPlan.updateMany(
    { user_id: uid, is_active: true },
    { $set: { is_active: false } },
  );

  // 3. Create new plan document.
  const plan = await AtlasUserPlan.create({
    user_id: uid,
    plan_id: planDoc.plan_id,
    plan_name: planDoc.plan_name,
    is_active: true,
    status: "active",
    billing_cycle: planDoc.billing_cycle || "custom",
    started_at: now,
    expires_at: expiresAt,
    trial_ends_at: null,
    payment_provider: "none",
    notes: `Plan assigned via internal API on ${now.toISOString()}.`,
  });

  // 4. Sync consumable limits; update team capacity on owner's atlas_teams.
  const planLimits = planDoc.plan_limits || {};
  await syncUserAvailableLimits(uid, planLimits);
  await syncTeamMaxMembers(uid, resolveMaxTeamMembers(planLimits));

  return { success: true, plan, message: "Plan assigned successfully." };
};

module.exports = { ensureTrialPlan, assignPlanToUser, syncUserAvailableLimits };
