const express = require("express");
const cors = require("cors");

const dotenv = require("dotenv");
dotenv.config();

const routes = require("./routes");

const connectToMongo = require("./db/mongo");

connectToMongo();

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://sgdevstudio.in",
      "https://www.sgdevstudio.in",
    ],
    credentials: true,
  })
);

// Mount your routes
app.use(routes);

module.exports = app;
