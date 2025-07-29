// routes/index.js
const express = require("express");
const router = express.Router();

// Import your auth router
const authRouter = require("./auth/auth_router");

// Prefix all auth routes with /v1/auth
router.use("/v1/auth", authRouter);

// (Other routes can be added here)
module.exports = router;
