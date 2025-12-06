// routes/index.js
const express = require("express");
const router = express.Router();

// Import your auth router
const authRouter = require("./auth/auth_router");
const atlasAuthRouter = require("./auth/atlas_auth_router");

const redisRouter = require("./redis/redis_router");

const elysiumChatRouter = require("./elysium_chat/elysium_route");

const sgdevstudioRouter = require("./portfolio_routes/sgdevstudio_routes");

// Prefix all auth routes with /v1/auth
router.use("/v1/auth", authRouter);

// Prefix all atlas auth routes with /elysium-atlas/v1/auth
router.use("/elysium-atlas", atlasAuthRouter);

router.use("/v1/redis", redisRouter);

router.use("/v1/elysium-chat", elysiumChatRouter);

router.use("/v1/connect", sgdevstudioRouter);

// (Other routes can be added here)
module.exports = router;
