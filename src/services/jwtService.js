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

/**
 * Inspect a JWT for internal debugging — verifies signature and reports expiry.
 * Returns decoded payload even when expired (for testing).
 */
function inspectJwtToken(token) {
  if (!token || typeof token !== "string") {
    return {
      valid: false,
      error: "missing_token",
      message: "Token is required.",
      payload: null,
    };
  }

  const trimmed = token.trim();
  const decoded = jwt.decode(trimmed, { complete: true });

  if (!decoded || typeof decoded.payload !== "object") {
    return {
      valid: false,
      error: "malformed_token",
      message: "Token is malformed.",
      payload: null,
    };
  }

  const { payload, header } = decoded;
  const meta = {
    header,
    issued_at: payload.iat
      ? new Date(payload.iat * 1000).toISOString()
      : null,
    expires_at: payload.exp
      ? new Date(payload.exp * 1000).toISOString()
      : null,
  };

  try {
    const verified = jwt.verify(trimmed, JWT_SECRET);
    return {
      valid: true,
      expired: false,
      payload: verified,
      ...meta,
    };
  } catch (err) {
    return {
      valid: false,
      expired: err.name === "TokenExpiredError",
      error: err.name,
      message: err.message,
      payload,
      ...meta,
    };
  }
}

module.exports = { generateJwtToken, verifyJwtToken, inspectJwtToken };
