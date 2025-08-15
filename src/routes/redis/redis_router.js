const { clearRedis } = require("../../helpers/redisUtils");
const express = require("express");
const router = express.Router();

// Flush Redis DB
router.post("/flush-redis", async (req, res) => {
  try {
    const providedPassword = req.headers["x-admin-password"];
    const ADMIN_FLUSH_PASSWORD =
      process.env.REDIS_FLUSH_PASSWORD || "supersecret";

    if (!providedPassword || providedPassword !== ADMIN_FLUSH_PASSWORD) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid or missing password header." });
    }

    await clearRedis();

    res.status(200).json({ message: "Redis database flushed successfully." });
  } catch (err) {
    console.error("Flush Redis Route Error:", err);
    res.status(500).json({ error: "Failed to flush Redis DB." });
  }
});

module.exports = router;
