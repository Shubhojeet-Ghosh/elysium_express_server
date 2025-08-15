const mongoose = require("mongoose");

const contactEntrySchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"],
      default: "accepted",
    },
    added_at: { type: Date, default: Date.now },
  },
  { _id: false }
); // << Disable auto _id

const pendingRequestSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      ref: "User",
      required: true,
    },
    sent_at: { type: Date, default: Date.now },
  },
  { _id: false }
); // << Disable auto _id

const blockedEntrySchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      ref: "User",
      required: true,
    },
    blocked_at: { type: Date, default: Date.now },
  },
  { _id: false }
); // << Disable auto _id

const contactListSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: { type: String, required: true },
    contacts: [contactEntrySchema],
    pending_requests: [pendingRequestSchema],
    blocked: [blockedEntrySchema],
  },
  {
    timestamps: true,
    collection: "contact_list",
  }
);

const ContactList = mongoose.model("Contact_List", contactListSchema);
module.exports = ContactList;
