// routes/auth/atlas_auth_router.js
const express = require("express");
const router = express.Router();
const atlasAuthController = require("../../controllers/atlasAuthController");
const atlasPlanController = require("../../controllers/atlasPlanController");
const {
  authenticateToken,
  authenticateApplicationSecret,
} = require("../../middlewares/authMiddleware");

// POST /elysium-atlas/v1/auth/magic-link
router.post("/v1/auth/magic-link", atlasAuthController.sendMagicLinkOrLogin);

router.post("/v1/auth/verify", atlasAuthController.verifyMagicLink);

router.post("/v1/auth/select-team", atlasAuthController.selectTeam);

router.post(
  "/v1/auth/decode-token",
  authenticateApplicationSecret,
  atlasAuthController.decodeToken,
);

router.post(
  "/v1/auth/profile/update",
  authenticateToken,
  atlasAuthController.updateProfile,
);

router.post(
  "/v1/auth/verify-google-login",
  atlasAuthController.verifyGoogleLogin,
);

// POST /elysium-atlas/v1/plan/info
router.post(
  "/v1/plan/info",
  authenticateToken,
  atlasPlanController.getUserPlanInfo,
);

// Internal plan admin routes — Authorization header = APPLICATION_SECRET_KEY
router.post(
  "/v1/plan/assign",
  authenticateApplicationSecret,
  atlasPlanController.assignPlan,
);
router.post(
  "/v1/plan/create",
  authenticateApplicationSecret,
  atlasPlanController.createPlan,
);
router.post(
  "/v1/plan/update",
  authenticateApplicationSecret,
  atlasPlanController.updatePlan,
);

module.exports = router;
