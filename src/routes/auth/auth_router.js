// routes/auth/auth_router.js
const express = require("express");
const router = express.Router();
const authController = require("../../controllers/authController");
const { authenticateToken } = require("../../middlewares/authMiddleware");

// POST /v1/auth/magic-link
router.post("/magic-link", authController.sendMagicLinkOrLogin);

router.post("/verify", authController.verifyMagicLink);

router.post(
  "/profile/complete",
  authenticateToken,
  authController.completeProfile
);

router.post("/verify-google-login", authController.verifyGoogleLogin);

module.exports = router;
