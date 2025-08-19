const mongoose = require("mongoose");

const contactRelationSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    contact_id: {
      type: String,
      required: true,
      index: true,
    },
    alias_name: { type: String, default: null },

    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"],
      required: true,
    },

    initiated_by: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
    collection: "contact_relations",
  }
);

// Prevent duplicate pairs in the same direction
contactRelationSchema.index({ user_id: 1, contact_id: 1 }, { unique: true });

const ContactRelation = mongoose.model(
  "ContactRelation",
  contactRelationSchema
);
module.exports = ContactRelation;
