// routes/auth/atlas_auth_router.js
const express = require("express");
const router = express.Router();
const atlasAuthController = require("../../controllers/atlasAuthController");
const atlasPlanController = require("../../controllers/atlasPlanController");
const { authenticateToken } = require("../../middlewares/authMiddleware");

// POST /elysium-atlas/v1/auth/magic-link
router.post("/v1/auth/magic-link", atlasAuthController.sendMagicLinkOrLogin);

router.post("/v1/auth/verify", atlasAuthController.verifyMagicLink);

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

// POST /elysium-atlas/v1/plan/assign  (internal — secured via application_secret_key)
router.post("/v1/plan/assign", atlasPlanController.assignPlan);

module.exports = router;
