// routes/auth/atlas_auth_router.js
const express = require("express");
const router = express.Router();
const atlasAuthController = require("../../controllers/atlasAuthController");
const { authenticateToken } = require("../../middlewares/authMiddleware");

// POST /elysium-atlas/v1/auth/magic-link
router.post("/v1/auth/magic-link", atlasAuthController.sendMagicLinkOrLogin);

router.post("/v1/auth/verify", atlasAuthController.verifyMagicLink);

router.post(
  "/v1/auth/profile/update",
  authenticateToken,
  atlasAuthController.updateProfile
);

router.post(
  "/v1/auth/verify-google-login",
  atlasAuthController.verifyGoogleLogin
);

module.exports = router;
