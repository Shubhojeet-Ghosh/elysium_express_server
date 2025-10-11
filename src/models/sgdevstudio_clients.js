const mongoose = require("mongoose");

const sgdevstudioClientSchema = new mongoose.Schema({
  client_id: {
    type: String,
    required: true,
    unique: true, // ensures no duplicate client_id
  },
  ip: {
    type: String,
  },
  country_name: {
    type: String,
  },
  city: {
    type: String,
  },
  created_at: {
    type: Date,
    default: () => new Date(), // manually set current UTC time
  },
});

// Explicitly set the collection name
module.exports = mongoose.model(
  "SGDevStudioClient",
  sgdevstudioClientSchema,
  "sgdevstudio_clients"
);
