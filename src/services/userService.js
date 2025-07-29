const User = require("../models/users"); // Import your Mongoose user model

/**
 * Finds a user by email, creates if not exists, and returns status.
 * @param {string} email
 * @returns {Promise<{ created: boolean, user: object }>}
 */
async function findOrCreateUserByEmail(email) {
  let user = await User.findOne({ email });
  let created = false;
  if (!user) {
    user = await User.create({ email });
    created = true;
  }
  return { created, user };
}

module.exports = { findOrCreateUserByEmail };
