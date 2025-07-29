const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

const connectToMongo = async () => {
  try {
    console.log("Connecting to MongoDB... with URI:", MONGO_URI);
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
    });
    console.log("Connection to MongoDB successful...");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

module.exports = connectToMongo;
