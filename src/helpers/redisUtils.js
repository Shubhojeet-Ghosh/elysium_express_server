const { redisClient } = require("../config/redisClient");

/**
 * Stores a key-value pair in Redis with an expiration time (in seconds).
 */
async function saveToRedis(key, value, expiryInSeconds = 3600) {
  try {
    await redisClient.set(key, value, { EX: expiryInSeconds });
    console.log(`Redis SET | Key: "${key}" | Expires in: ${expiryInSeconds}s`);
  } catch (err) {
    console.error(`Redis SET error | Key: "${key}" |`, err);
  }
}

/**
 * Retrieves a value from Redis by key.
 */
async function getFromRedis(key) {
  try {
    const value = await redisClient.get(key);
    console.log(`Redis GET | Key: "${key}" | Value:`, value);
    return value;
  } catch (err) {
    console.error(`Redis GET error | Key: "${key}" |`, err);
    return null;
  }
}

/**
 * Deletes a key from Redis.
 */
async function deleteFromRedis(key) {
  try {
    await redisClient.del(key);
    console.log(`Redis DEL | Key: "${key}"`);
  } catch (err) {
    console.error(`Redis DEL error | Key: "${key}" |`, err);
  }
}

/**
 * Clears all keys in the current Redis database.
 */
async function clearRedis() {
  try {
    await redisClient.flushDb();
    console.log("Redis FLUSHDB | All keys cleared");
  } catch (err) {
    console.error("Redis FLUSHDB error |", err);
  }
}
module.exports = {
  saveToRedis,
  getFromRedis,
  deleteFromRedis,
  clearRedis,
};
