const User = require("../../models/users");
const Contacts = require("../../models/contacts");
const {
  broadcastContactAdded,
  broadcastContactAccepted,
} = require("./socketBroadcasters");

async function ensureContactsDocument(userIdStr, email) {
  const existing = await Contacts.findById(userIdStr);
  if (!existing) {
    await Contacts.create({
      _id: userIdStr,
      email,
      contacts: [],
      pending_requests: [],
    });
  }
}

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

    // Step 1: Ensure both contacts documents exist
    await ensureContactsDocument(receiverIdStr, receiver.email);
    await ensureContactsDocument(senderIdStr, sender.email);

    // Step 2: Add sender to receiver's pending_requests
    await Contacts.updateOne(
      {
        _id: receiverIdStr,
        "pending_requests.user_id": { $ne: senderIdStr },
      },
      {
        $addToSet: {
          pending_requests: {
            user_id: senderIdStr,
            sent_at: new Date(),
          },
        },
      }
    );

    // Step 3: Add receiver to sender's contacts
    await Contacts.updateOne(
      {
        _id: senderIdStr,
        "contacts.user_id": { $ne: receiverIdStr },
      },
      {
        $addToSet: {
          contacts: {
            user_id: receiverIdStr,
            alias_name: data.alias_name || receiver.first_name || "",
            status: "pending",
            added_at: new Date(),
          },
        },
      }
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

async function acceptToConnect(io, socket, data) {
  try {
    const currentUser = socket.data.user; // logged-in user
    const contactEmail = data.contact_email;

    console.log(
      `Accepting contact request from ${contactEmail} for ${currentUser.email}`
    );

    // Step 1: Get the other user (sender of the request)
    const senderUser = await User.findOne({ email: contactEmail });
    if (!senderUser) {
      return socket.emit("contact-error", {
        message: `User with email ${contactEmail} not found.`,
        tech_message: "Invalid contact_email provided",
      });
    }

    const currentUserIdStr = currentUser.user_id;
    const senderUserIdStr = senderUser._id.toString();

    // Step 2: Remove sender from current user's pending_requests
    await Contacts.updateOne(
      { _id: currentUserIdStr },
      { $pull: { pending_requests: { user_id: senderUserIdStr } } }
    );

    // Step 3: Add sender to current user's contacts (status: accepted)
    await Contacts.updateOne(
      { _id: currentUserIdStr, "contacts.user_id": { $ne: senderUserIdStr } },
      {
        $addToSet: {
          contacts: {
            user_id: senderUserIdStr,
            alias_name: data.alias_name || senderUser.first_name || "",
            status: "accepted",
            added_at: new Date(),
          },
        },
      }
    );

    // Step 4: Update sender's contact entry for current user to status: accepted
    await Contacts.updateOne(
      { _id: senderUserIdStr, "contacts.user_id": currentUserIdStr },
      { $set: { "contacts.$.status": "accepted" } }
    );

    // Step 5: Notify sender that their request was accepted
    await broadcastContactAccepted(io, currentUser, senderUser);

    console.log(
      `Contact request from ${senderUser.email} accepted by ${currentUser.email}`
    );
  } catch (error) {
    console.error("Error in acceptToConnect:", error);
    socket.emit("contact-error", {
      message: "Failed to accept contact request.",
      tech_message: error.message,
    });
  }
}

module.exports = {
  addToContacts,
  acceptToConnect,
};
