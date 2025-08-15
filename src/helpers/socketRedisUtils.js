const { redisClient } = require("../config/redisClient");
const SOCKET_KEY_PREFIX = "user";

/**
 * Add a socket ID to a user's hash with metadata.
 */
async function addUserSocketId(
  userId,
  socketId,
  expiryInSeconds = 3600,
  metadata = {}
) {
  const key = `${SOCKET_KEY_PREFIX}-${userId}-sockets`;
  const data = {
    connected_at: new Date().toISOString(),
    ...metadata, // e.g., ip, user_agent, location, etc.
  };
  await redisClient.hSet(key, socketId, JSON.stringify(data));
  await redisClient.expire(key, expiryInSeconds); // TTL on the whole hash
}

/**
 * Get all socket IDs for a user as a list.
 */
async function getUserSocketIds(userId) {
  const key = `${SOCKET_KEY_PREFIX}-${userId}-sockets`;
  const socketIds = await redisClient.hKeys(key); // returns list of field names (i.e., socket IDs)
  return socketIds || []; // fallback to empty list if null
}

/**
 * Get all socket metadata for a user.
 */
async function getUserSocketMetadata(userId) {
  const key = `${SOCKET_KEY_PREFIX}-${userId}-sockets`;
  const raw = await redisClient.hGetAll(key);
  const result = {};
  for (const socketId in raw) {
    try {
      result[socketId] = JSON.parse(raw[socketId]);
    } catch {
      result[socketId] = raw[socketId]; // fallback if not JSON
    }
  }
  return result;
}

/**
 * Remove a specific socket ID for a user.
 */
async function removeUserSocketId(userId, socketId) {
  const key = `${SOCKET_KEY_PREFIX}-${userId}-sockets`;
  await redisClient.hDel(key, socketId);
}

/**
 * Remove all socket connections for a user.
 */
async function removeAllUserSocketIds(userId) {
  const key = `${SOCKET_KEY_PREFIX}-${userId}-sockets`;
  await redisClient.del(key);
}

/**
 * Get metadata for all connected users and their sockets.
 */
const getAllConnectedUsers = async () => {
  try {
    let cursor = "0";
    const connectedUsers = [];

    do {
      const result = await redisClient.scan(cursor, {
        MATCH: "user-*-sockets",
        COUNT: 100,
      });

      cursor = result.cursor;
      const keys = result.keys;

      for (const key of keys) {
        const user_id = key.slice(
          SOCKET_KEY_PREFIX.length + 1,
          key.lastIndexOf("-sockets")
        );

        const raw = await redisClient.hGetAll(key);

        const sockets = Object.entries(raw).map(([socketId, value]) => {
          try {
            return { socket_id: socketId, ...JSON.parse(value) };
          } catch {
            return { socket_id: socketId, raw: value };
          }
        });

        if (sockets.length > 0) {
          connectedUsers.push({ user_id, sockets });
        }
      }
    } while (cursor !== "0");

    return connectedUsers;
  } catch (error) {
    console.error("Error fetching connected users from Redis:", error);
    return [];
  }
};

/**
 * Remove all users (for cleanup or reset).
 */
const removeAllConnectedUsers = async () => {
  try {
    let cursor = "0";
    const keysToDelete = [];

    do {
      const result = await redisClient.scan(cursor, {
        MATCH: "user-*-sockets",
        COUNT: 100,
      });

      cursor = result.cursor;
      keysToDelete.push(...result.keys);
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
    }

    console.log(`[Redis] Removed all connected user socket entries.`);
  } catch (err) {
    console.error("Failed to remove all connected users:", err.message);
  }
};

module.exports = {
  addUserSocketId,
  getUserSocketIds,
  getUserSocketMetadata,
  removeUserSocketId,
  removeAllUserSocketIds,
  getAllConnectedUsers,
  removeAllConnectedUsers,
};
