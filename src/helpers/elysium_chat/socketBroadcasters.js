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

async function broadcastContactAccepted(io, accepter, sender) {
  const senderSocketIds = await getUserSocketIds(sender._id.toString());

  if (!senderSocketIds.length) {
    console.log(`[Broadcast] No active sockets for ${sender.email}`);
    return;
  }

  const message = `${
    accepter.first_name || accepter.email
  } has accepted your contact request.`;

  senderSocketIds.forEach((socketId) => {
    io.to(socketId).emit("contact-accepted", {
      from: accepter.first_name || accepter.email,
      email: accepter.email,
      message,
    });
  });

  console.log(
    `[Broadcast] Sent contact accepted notification to ${sender.email}`
  );
}

module.exports = {
  broadcastContactAdded,
  broadcastContactAccepted,
};
