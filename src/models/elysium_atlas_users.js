const mongoose = require("mongoose");

const elysiumAtlasUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String },
    first_name: { type: String },
    last_name: { type: String },
    profile_image_url: { type: String, default: null },
    is_profile_complete: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "elysium_atlas_users", // Ensures the MongoDB collection is "elysium_atlas_users"
  }
);

// "ElysiumAtlasUser" is the name of the model (PascalCase, singular)
const ElysiumAtlasUser = mongoose.model("ElysiumAtlasUser", elysiumAtlasUserSchema);

module.exports = ElysiumAtlasUser;


