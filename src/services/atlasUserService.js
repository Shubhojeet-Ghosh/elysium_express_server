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

module.exports = { findOrCreateUserByEmail };


