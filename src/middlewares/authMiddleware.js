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
 * Internal atlas admin routes — Authorization header must be the raw
 * APPLICATION_SECRET_KEY value (no "Bearer " prefix).
 */
function authenticateApplicationSecret(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(200).json({
      success: false,
      message: "Authorization header is required.",
    });
  }

  const secret = authHeader.trim();

  if (secret.startsWith("Bearer ")) {
    return res.status(200).json({
      success: false,
      message: "Use the raw APPLICATION_SECRET_KEY in Authorization (no Bearer prefix).",
    });
  }

  if (secret !== process.env.APPLICATION_SECRET_KEY) {
    return res.status(200).json({
      success: false,
      message: "Invalid Authorization.",
    });
  }

  next();
}

module.exports = { authenticateToken, authenticateApplicationSecret };
