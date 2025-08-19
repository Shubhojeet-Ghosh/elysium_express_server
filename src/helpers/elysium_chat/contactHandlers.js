const User = require("../../models/users");
const Contacts = require("../../models/contacts");
const ContactRelation = require("../../models/contact_relations");
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
    // Step 1: Find the receiver user
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

    // Step 2: Ensure relation does not already exist
    const existingRelation = await ContactRelation.findOne({
      user_id: senderIdStr,
      contact_id: receiverIdStr,
    });

    if (existingRelation) {
      return socket.emit("contact-error", {
        message: "Contact request already sent or already connected.",
        tech_message: "Duplicate contact relation attempt.",
      });
    }

    // Step 3: Create relation from sender → receiver with pending status
    await ContactRelation.create({
      user_id: senderIdStr,
      contact_id: receiverIdStr,
      alias_name: data.alias_name || receiver.first_name || "",
      status: "pending",
      initiated_by: senderIdStr,
    });

    // Step 4: Notify sender
    socket.emit("contact-request-sent", {
      message: `Request sent to ${receiver.first_name}`,
    });

    // Step 5: Optionally broadcast event to receiver (if online)
    await broadcastContactAdded(io, sender, receiver);

    console.log(
      `Pending request from ${sender.email} to ${receiver.email} saved in contact_relations.`
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

    // Step 1: Get the sender of the original request
    const senderUser = await User.findOne({ email: contactEmail });
    if (!senderUser) {
      return socket.emit("contact-error", {
        message: `User with email ${contactEmail} not found.`,
        tech_message: "Invalid contact_email provided",
      });
    }

    const currentUserIdStr = currentUser.user_id;
    const senderUserIdStr = senderUser._id.toString();

    // Step 2: Find the pending relation (sender -> currentUser)
    const relation = await ContactRelation.findOne({
      user_id: senderUserIdStr,
      contact_id: currentUserIdStr,
      status: "pending",
    });

    if (!relation) {
      return socket.emit("contact-error", {
        message: "No pending request found from this user.",
        tech_message: "No matching pending relation in DB",
      });
    }

    // Step 3: Update sender -> currentUser relation to accepted
    relation.status = "accepted";
    await relation.save();

    // Step 4: Create mirrored relation (currentUser -> sender)
    const existingMirror = await ContactRelation.findOne({
      user_id: currentUserIdStr,
      contact_id: senderUserIdStr,
    });

    if (!existingMirror) {
      await ContactRelation.create({
        user_id: currentUserIdStr,
        contact_id: senderUserIdStr,
        alias_name: data.alias_name || senderUser.first_name || "",
        status: "accepted",
        initiated_by: relation.initiated_by, // original initiator stays same
      });
    } else {
      // Just in case it exists but isn't accepted yet
      existingMirror.status = "accepted";
      await existingMirror.save();
    }

    // Step 5: Notify sender that their request was accepted
    await broadcastContactAccepted(io, currentUser, senderUser);

    console.log(
      `Contact request from ${senderUser.email} accepted by ${currentUser.email}`
    );

    // Send ack to the current user too
    socket.emit("contact-accepted", {
      message: `You are now connected with ${senderUser.first_name}`,
    });
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
