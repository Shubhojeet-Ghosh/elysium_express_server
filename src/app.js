const express = require("express");

const dotenv = require("dotenv");
dotenv.config();

const routes = require("./routes");

const connectToMongo = require("./db/mongo");

connectToMongo();

const app = express();

app.use(express.json());

// Mount your routes
app.use(routes);

module.exports = app;
