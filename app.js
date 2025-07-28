const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  const appEnv = process.env.APP_ENV || "development";
  const appVersion = process.env.APP_VERSION;
  console.log(
    `Express server is running on ${appEnv} environment, version ${appVersion}.`
  );
  res.send(
    `Express server is running on ${appEnv} environment, version ${appVersion}.`
  );
});

app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
