const AtlasPlan = require("../models/atlas_plans");

/**
 * Creates a new plan definition in atlas_plans.
 *
 * @param {{ plan_id: string, plan_name: string, [key: string]: unknown }} payload
 * @returns {Promise<{ success: boolean, plan: object | null, message: string }>}
 */
const createAtlasPlan = async (payload) => {
  const plan_id = String(payload.plan_id).trim();
  const plan_name = String(payload.plan_name).trim();

  const existing = await AtlasPlan.findOne({ plan_id }).lean();
  if (existing) {
    return {
      success: false,
      plan: null,
      message: `Plan '${plan_id}' already exists.`,
    };
  }

  const { plan_id: _pid, plan_name: _pname, ...rest } = payload;

  try {
    const plan = await AtlasPlan.create({
      plan_id,
      plan_name,
      ...rest,
    });
    return { success: true, plan, message: "Plan created successfully." };
  } catch (err) {
    if (err.code === 11000) {
      return {
        success: false,
        plan: null,
        message: `Plan '${plan_id}' already exists.`,
      };
    }
    throw err;
  }
};

/**
 * Updates an existing plan definition by plan_id.
 * All fields in `updates` are applied via $set.
 *
 * @param {string} plan_id
 * @param {Record<string, unknown>} updates
 * @returns {Promise<{ success: boolean, plan: object | null, message: string }>}
 */
const updateAtlasPlan = async (plan_id, updates) => {
  const pid = String(plan_id).trim();

  const plan = await AtlasPlan.findOneAndUpdate(
    { plan_id: pid },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!plan) {
    return {
      success: false,
      plan: null,
      message: `Plan '${pid}' not found.`,
    };
  }

  return { success: true, plan, message: "Plan updated successfully." };
};

module.exports = { createAtlasPlan, updateAtlasPlan };
