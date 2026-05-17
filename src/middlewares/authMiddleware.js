const { verifyJwtToken } = require("../services/jwtService");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided." });
  }
  const decoded = verifyJwtToken(token);
  if (!decoded) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token." });
  }

  // Attach everything you want available in controllers:
  req.user = decoded; // decoded contains user_id, email, etc.
  next();
}

/**
 * Internal atlas admin routes — expects APPLICATION_SECRET_KEY in the
 * Authorization header (not the body). Supports raw value or Bearer <secret>.
 */
function authenticateApplicationSecret(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(200).json({
      success: false,
      message: "Authorization header is required.",
    });
  }

  const secret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (secret !== process.env.APPLICATION_SECRET_KEY) {
    return res.status(200).json({
      success: false,
      message: "Invalid Authorization.",
    });
  }

  next();
}

module.exports = { authenticateToken, authenticateApplicationSecret };
