// routes/auth/auth_router.js
const express = require("express");
const router = express.Router();
const authController = require("../../controllers/authController");

// POST /v1/auth/magic-link
router.post("/magic-link", authController.sendMagicLink);

// (You can add more auth-related routes here in the future)

module.exports = router;
