// routes/index.js
const express = require("express");
const router = express.Router();

// Import your auth router
const authRouter = require("./auth/auth_router");

const redisRouter = require("./redis/redis_router");

const elysiumChatRouter = require("./elysium_chat/elysium_route");

// Prefix all auth routes with /v1/auth
router.use("/v1/auth", authRouter);

router.use("/v1/redis", redisRouter);

router.use("/v1/elysium-chat", elysiumChatRouter);

// (Other routes can be added here)
module.exports = router;
