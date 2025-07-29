const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Generate a JWT token
 * @param {Object} payload - Data to store in the token
 * @param {String} expiresIn - Expiry (e.g., "15m", "1d")
 * @returns {String} JWT token
 */
function generateJwtToken(payload, expiresIn) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify a JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object|null} Decoded payload if valid, or null if invalid/expired
 * @throws {Error} If verification fails (optional: handle in controller)
 */
function verifyJwtToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // Option 1: return null if invalid/expired
    return null;
    // Option 2: throw err if you want to handle it elsewhere
    // throw err;
  }
}

module.exports = { generateJwtToken, verifyJwtToken };
