const User = require("../../models/users");
const Contacts = require("../../models/contacts");
const { broadcastContactAdded } = require("./socketBroadcasters");

async function addToContacts(io, socket, data) {
  const sender = socket.data.user;
  const contactEmail = data.contact_email;

  console.log(`Adding ${contactEmail} to ${sender.email}'s contacts`);

  try {
    const receiver = await User.findOne({ email: contactEmail });
    if (!receiver) {
      return socket.emit("contact-error", {
        message: `Sorry, we couldn't find that user.`,
        tech_message: `User with email ${contactEmail} not found.`,
      });
    }

    if (receiver._id.toString() === sender.user_id) {
      return socket.emit("contact-error", {
        message: "You cannot add yourself as a contact.",
        tech_message: "You cannot add yourself as a contact.",
      });
    }

    const receiverIdStr = receiver._id.toString();
    const senderIdStr = sender.user_id;

    // 1. Update receiver's pending_requests if not already present
    await Contacts.findOneAndUpdate(
      {
        _id: receiver._id,
        "pending_requests.user_id": { $ne: senderIdStr },
      },
      {
        $addToSet: {
          pending_requests: {
            user_id: senderIdStr,
            sent_at: new Date(),
          },
        },
      },
      { new: true, upsert: false }
    );

    // Ensure contact doc exists for receiver
    await Contacts.updateOne(
      { _id: receiver._id },
      { $setOnInsert: { email: receiver.email } },
      { upsert: true }
    );

    // 2. Update sender's contacts if not already present
    await Contacts.findOneAndUpdate(
      {
        _id: senderIdStr,
        "contacts.user_id": { $ne: receiverIdStr },
      },
      {
        $addToSet: {
          contacts: {
            user_id: receiverIdStr,
            status: "pending",
            added_at: new Date(),
          },
        },
      },
      { new: true, upsert: false }
    );

    // Ensure contact doc exists for sender
    await Contacts.updateOne(
      { _id: senderIdStr },
      { $setOnInsert: { email: sender.email } },
      { upsert: true }
    );

    socket.emit("contact-request-sent", {
      message: `Request sent to ${receiver.first_name}`,
    });

    await broadcastContactAdded(io, sender, receiver);

    console.log(
      `Pending request from ${sender.email} to ${receiver.email} saved.`
    );
  } catch (error) {
    console.error("Error in addToContacts:", error);
    socket.emit("contact-error", {
      message: "Failed to send contact request.",
      tech_message: error.message,
    });
  }
}

module.exports = {
  addToContacts,
};
