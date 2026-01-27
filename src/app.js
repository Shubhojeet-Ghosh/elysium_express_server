const express = require("express");
const cors = require("cors");

const dotenv = require("dotenv");
dotenv.config();

const routes = require("./routes");
const allowedOrigins = require("./config/corsOrigins");

const connectToMongo = require("./db/mongo");

connectToMongo();

const app = express();

app.use(express.json());

const corsOptions =
  process.env.APP_ENV === "development"
    ? {
        origin: true,
      }
    : {
        origin: allowedOrigins,
        credentials: true,
      };

app.use(cors(corsOptions));

// Mount your routes
app.use(routes);

module.exports = app;
