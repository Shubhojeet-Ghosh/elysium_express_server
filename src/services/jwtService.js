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

module.exports = { generateJwtToken };
