const http = require("http");

const app = require("./app");
const { setupSocket } = require("./sockets");

const server = http.createServer(app);
setupSocket(server);

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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
