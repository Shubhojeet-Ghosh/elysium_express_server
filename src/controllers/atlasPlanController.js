const {
  getFullUserPlanInfo,
} = require("../services/atlasUserPlanQueryService");
const {
  ensureTrialPlan,
  assignPlanToUser,
} = require("../services/atlasUserPlanService");
const {
  createAtlasPlan,
  updateAtlasPlan,
} = require("../services/atlasPlanCatalogService");
const { getUserIdByEmail } = require("../services/atlasUserService");

/**
 * POST /elysium-atlas/v1/plan/info
 *
 * Returns the active plan details, original plan limits, and available
 * (remaining) limits for the requesting user.
 *
 * If no plan or limits doc exists yet (e.g. legacy accounts), a 7-day trial
 * is provisioned on-the-fly before the response is returned.
 *
 * The user_id is read from the verified JWT payload (req.user.user_id)
 * injected by the authenticateToken middleware — no body/query param needed.
 */
const getUserPlanInfo = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    let planInfo = await getFullUserPlanInfo(user_id);

    // No plan or limits doc — provision a trial now, then re-fetch.
    if (!planInfo || !planInfo.available_limits) {
      await ensureTrialPlan(
        user_id,
        "Auto-provisioned trial via plan/info endpoint.",
      );
      planInfo = await getFullUserPlanInfo(user_id);
    }

    if (!planInfo) {
      return res.status(200).json({
        success: false,
        message: "Unable to provision a plan for this user.",
      });
    }

    return res.status(200).json({
      success: true,
      plan_data: planInfo,
    });
  } catch (err) {
    console.error("[getUserPlanInfo]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * POST /elysium-atlas/v1/plan/assign
 *
 * Internal endpoint — assigns a plan to a user.
 * Secured via Authorization header (APPLICATION_SECRET_KEY).
 *
 * Body: { user_id | email, plan_id }
 */
const assignPlan = async (req, res) => {
  try {
    const { user_id, email, plan_id } = req.body;

    if ((!user_id && !email) || !plan_id) {
      return res.status(200).json({
        success: false,
        message: "plan_id and either user_id or email are required.",
      });
    }

    // Resolve user_id from email if not directly provided.
    let resolvedUserId = user_id;
    if (!resolvedUserId && email) {
      resolvedUserId = await getUserIdByEmail(email);
      if (!resolvedUserId) {
        return res.status(200).json({
          success: false,
          message: `No user found for email '${email.trim().toLowerCase()}'.`,
        });
      }
    }

    const result = await assignPlanToUser(resolvedUserId, plan_id);

    if (!result.success) {
      return res.status(200).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      plan: result.plan,
    });
  } catch (err) {
    console.error("[assignPlan]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * POST /elysium-atlas/v1/plan/create
 *
 * Internal endpoint — creates a plan definition in atlas_plans.
 * Secured via Authorization header (APPLICATION_SECRET_KEY).
 *
 * Body: { plan_id, plan_name, ...optional fields }
 */
const createPlan = async (req, res) => {
  try {
    const { plan_id, plan_name, ...rest } = req.body;

    if (!plan_id || !plan_name) {
      return res.status(200).json({
        success: false,
        message: "plan_id and plan_name are required.",
      });
    }

    const result = await createAtlasPlan({ plan_id, plan_name, ...rest });

    if (!result.success) {
      return res.status(200).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      plan: result.plan,
    });
  } catch (err) {
    console.error("[createPlan]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * POST /elysium-atlas/v1/plan/update
 *
 * Internal endpoint — updates a plan definition by plan_id.
 * Secured via Authorization header (APPLICATION_SECRET_KEY).
 *
 * Body: { plan_id, ...fields to update }
 */
const updatePlan = async (req, res) => {
  try {
    const { plan_id, ...updates } = req.body;

    if (!plan_id) {
      return res.status(200).json({
        success: false,
        message: "plan_id is required.",
      });
    }

    const result = await updateAtlasPlan(plan_id, updates);

    if (!result.success) {
      return res.status(200).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      plan: result.plan,
    });
  } catch (err) {
    console.error("[updatePlan]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { getUserPlanInfo, assignPlan, createPlan, updatePlan };
