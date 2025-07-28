const { Server } = require("socket.io");

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" }, // Adjust for production!
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Example listener
    socket.on("ping", (data) => {
      console.log("Received ping:", data);
      socket.emit("pong", { message: "pong!" });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, "Reason:", reason);
    });
  });
}

module.exports = { setupSocket };
