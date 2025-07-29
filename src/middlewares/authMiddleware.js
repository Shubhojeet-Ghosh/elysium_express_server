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

module.exports = { authenticateToken };
