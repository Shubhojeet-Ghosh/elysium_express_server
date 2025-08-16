const { Server } = require("socket.io");
const socketAuthMiddleware = require("./authMiddleware"); // adjust path if needed
const {
  addToContacts,
  acceptToConnect,
} = require("../helpers/elysium_chat/contactHandlers");

const {
  addUserSocketId,
  getUserSocketIds,
  removeAllConnectedUsers,
  getAllConnectedUsers,
  removeUserSocketId,
} = require("../helpers/socketRedisUtils");

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" }, // Adjust for production!
  });
  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    console.log("[event:connect] socket connected:", socket.id);
    const user = socket.data.user;

    if (user && user.user_id) {
      await addUserSocketId(user.user_id, socket.id);
      const socketIds = await getUserSocketIds(user.user_id);
      // console.log(`socketIds for user ${user.user_id}`, socketIds);
      const connectedUsers = await getAllConnectedUsers();
      console.log("connectedUsers", JSON.stringify(connectedUsers, null, 2));
      console.log("Number of connected users", connectedUsers.length);
    }
    // Example listener
    socket.on("ping", (data) => {
      console.log("[event:ping] socket.data.user", socket.data.user);
      console.log("Received ping:", data);
      socket.emit("pong", { message: "pong!" });
    });

    socket.on("add-to-contacts", async (data) => {
      console.log("Received add-to-contacts:", socket.data.user);
      await addToContacts(io, socket, data);
    });

    socket.on("accept-to-connect", async (data) => {
      console.log("Received accept-to-connect:", socket.data.user);
      await acceptToConnect(io, socket, data);
    });

    socket.on("disconnect", async (reason) => {
      console.log("Socket disconnected:", socket.id, "Reason:", reason);
      const user_id = socket.data.user.user_id;
      if (user_id) {
        try {
          await removeUserSocketId(user_id, socket.id);
          console.log(
            `Removed socket ${socket.id} for user ${user_id} from Redis.`
          );
        } catch (err) {
          console.error(
            `Failed to remove socket ${socket.id} for user ${user_id}:`,
            err.message
          );
        }
      } else {
        console.warn(
          `No user_id found on socket ${socket.id}, skipping Redis cleanup.`
        );
      }
      const connectedUsers = await getAllConnectedUsers();
      console.log("connectedUsers", JSON.stringify(connectedUsers, null, 2));
      console.log("Number of connected users", connectedUsers.length);
    });
  });
}

module.exports = { setupSocket };
