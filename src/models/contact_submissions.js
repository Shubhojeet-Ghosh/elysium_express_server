const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    message: { type: String },
    date: { type: Date, default: Date.now },
  },
  { _id: false } // 👈 this disables the automatic _id for each message
);

const contactSubmissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // array of messages
    messages: [messageSchema],
  },
  {
    timestamps: true,
    collection: "contact_submissions", // Ensures the MongoDB collection is "contact_submissions"
  }
);

// "User" is the name of the model (PascalCase, singular)
const ContactSubmission = mongoose.model(
  "ContactSubmission",
  contactSubmissionSchema
);

module.exports = ContactSubmission;
