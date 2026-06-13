const {
  getFullTeamPlanInfo,
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
const { getTeamLimits, getUserRoleForTeam } = require("../services/atlasTeamService");

/**
 * POST /elysium-atlas/v1/plan/info
 *
 * Returns plan details for the **active team** in the session JWT (`team_id`).
 * Plan and consumable limits come from the **team owner's** subscription;
 * team capacity (max_team_members, member_count) comes from that team doc.
 *
 * Any team member (owner, admin, member) may call this for their session team.
 */
const getUserPlanInfo = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const teamId = req.user.team_id;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: "Team ID is missing from session.",
      });
    }

    const role = await getUserRoleForTeam(userId, teamId);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this team.",
      });
    }

    let planInfo = await getFullTeamPlanInfo(teamId);

    if (!planInfo || !planInfo.available_limits) {
      const teamLimits = await getTeamLimits(teamId);
      if (teamLimits?.owner_user_id) {
        await ensureTrialPlan(
          teamLimits.owner_user_id,
          "Auto-provisioned trial via plan/info endpoint (team owner).",
        );
      }
      planInfo = await getFullTeamPlanInfo(teamId);
    }

    if (!planInfo) {
      return res.status(200).json({
        success: false,
        message: "Unable to load plan info for this team.",
      });
    }

    return res.status(200).json({
      success: true,
      plan_data: {
        ...planInfo,
        team: {
          ...planInfo.team,
          caller_role: role,
        },
      },
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
