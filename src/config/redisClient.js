const { createClient } = require("redis");

function parseRedisDb() {
  const raw = process.env.REDIS_DB;
  if (raw === undefined || raw === "") return 1;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/** Strip /db from URL so `database` is controlled only by REDIS_DB. */
function normalizeRedisUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.pathname.length > 1) {
      u.pathname = "/";
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

const redisUrl = normalizeRedisUrl(
  process.env.REDIS_URL || "redis://localhost:6379"
);
const redisDb = parseRedisDb();

const redisClient = createClient({
  url: redisUrl,
  database: redisDb,
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

async function connectRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("Redis connected");
    }
  } catch (err) {
    console.error("Failed to connect to Redis. Exiting...");
    throw err; // Throw error so the server doesn't start
  }
}

module.exports = { redisClient, connectRedis };
