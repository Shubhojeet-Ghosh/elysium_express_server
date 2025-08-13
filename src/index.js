const http = require("http");
const { version: appVersion } = require("../package.json");

const app = require("./app");
const { setupSocket } = require("./sockets");
const { connectRedis } = require("./config/redisClient");

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  const appEnv = process.env.APP_ENV || "development";

  console.log(
    `Express server is running on ${appEnv} environment, version ${appVersion}.`
  );
  res.send(
    `Express server is running on ${appEnv} environment, version ${appVersion}.`
  );
});

(async () => {
  try {
    // Ensure Redis is connected before starting server
    await connectRedis();

    const server = http.createServer(app);

    // Setup WebSocket
    setupSocket(server);

    // Start listening
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
})();
