const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
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
    collection: "users", // Ensures the MongoDB collection is "users"
  }
);

// "User" is the name of the model (PascalCase, singular)
const User = mongoose.model("User", userSchema);

module.exports = User;
