const { verifyJwtToken } = require("../services/jwtService");

function authenticateSocketToken(token, socket) {
  // Remove 'Bearer ' prefix if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  // Verify token
  const decoded = verifyJwtToken(token);
  if (!decoded) {
    console.log(`[event:connect] Invalid or expired token.`);
    return null;
  }

  // Attach user info to socket
  socket.data.user = decoded;
  console.log(
    `[event:connect] Authenticated user: ${decoded.email} | socket.id: ${socket.id}`
  );

  return decoded;
}

// Main middleware function
function socketAuthMiddleware(socket, next) {
  try {
    const rawToken =
      socket.handshake.headers?.token || socket.handshake.auth?.token;
    console.log("[event:connect] rawToken", rawToken.slice(0, 20));
    if (rawToken) {
      const decoded = authenticateSocketToken(rawToken, socket);
      if (!decoded) return next(new Error("Invalid or expired token"));
    }

    next(); // allow the connection
  } catch (err) {
    console.error("Socket authentication error:", err.message);
    return next(new Error("Authentication failed"));
  }
}

module.exports = socketAuthMiddleware;
