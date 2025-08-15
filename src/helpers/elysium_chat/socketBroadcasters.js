const { getUserSocketIds } = require("../../helpers/socketRedisUtils");

/**
 * Notify all active sockets of the receiver about a new contact request.
 */
async function broadcastContactAdded(io, sender, receiver) {
  const receiverSocketIds = await getUserSocketIds(receiver._id.toString());

  if (!receiverSocketIds.length) {
    console.log(`[Broadcast] No active sockets for ${receiver.email}`);
    return;
  }

  const message = `${sender.first_name} has sent you a friend request`;

  receiverSocketIds.forEach((socketId) => {
    io.to(socketId).emit("new-contact-request", {
      from: sender.first_name,
      email: sender.email,
      message,
    });
  });

  console.log(
    `[Broadcast] Sent friend request notification to ${receiver.email}`
  );
}

module.exports = {
  broadcastContactAdded,
};
