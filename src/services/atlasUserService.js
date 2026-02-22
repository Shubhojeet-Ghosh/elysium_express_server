const ElysiumAtlasUser = require("../models/elysium_atlas_users"); // Import your Mongoose atlas user model

/**
 * Finds a user by email, creates if not exists, and returns status.
 * @param {string} email
 * @returns {Promise<{ created: boolean, user: object }>}
 */
async function findOrCreateUserByEmail(email) {
  let user = await ElysiumAtlasUser.findOne({ email });
  let created = false;
  if (!user) {
    user = await ElysiumAtlasUser.create({ email });
    created = true;
  }
  return { created, user };
}

/**
 * Looks up a user by email and returns their _id as a string.
 *
 * @param {string} email
 * @returns {Promise<string | null>}  user_id string, or null if not found.
 */
async function getUserIdByEmail(email) {
  if (!email) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const user = await ElysiumAtlasUser.findOne(
    { email: normalizedEmail },
    { _id: 1 },
  ).lean();

  if (!user) return null;
  return String(user._id);
}

module.exports = { findOrCreateUserByEmail, getUserIdByEmail };
