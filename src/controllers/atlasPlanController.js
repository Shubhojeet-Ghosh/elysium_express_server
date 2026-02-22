const {
  getFullUserPlanInfo,
} = require("../services/atlasUserPlanQueryService");
const { ensureTrialPlan } = require("../services/atlasUserPlanService");

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

module.exports = { getUserPlanInfo };
