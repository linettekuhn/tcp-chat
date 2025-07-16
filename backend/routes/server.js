const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const serverPath = path.join(__dirname, "../TCPChatServer.exe");

let cmdChar = null;

router.post("/start", (req, res) => {
  const { port, capacity, commandChar } = req.body;
  cmdChar = commandChar;

  if (!port || !capacity || !commandChar) {
    return res
      .status(400)
      .send("Missing port, capacity or command character in request");
  }

  // server mode
  // TCPChatServer.exe 0 <port> <capacity> <commandChar>
  const server = spawn(serverPath, [
    "0",
    String(port),
    String(capacity),
    String(commandChar),
  ]);

  // error checks
  server.on("error", (error) => {
    console.error("Failed to start server:", error);
    return res.status(500).send("Failed to start server");
  });

  server.stderr.once("data", (data) => {
    console.error(`Server Error: ${data}`);
    return res.status(500).send(`Server Error: ${data}`);
  });

  // output stream
  server.stdout.once("data", (data) => {
    console.log(`Server: ${data}`);
    res.status(200).send(`Server: ${data}`);
  });
});

router.post("/stop", (req, res) => {
  const { port, serverAddress } = req.body;
  if (!port || !serverAddress) {
    res.status(400).send("Missing port or server IP address in request.");
  }
  const shutdownCmd = `${cmdChar}shutdown\n`;
  const disconnectCmd = `${cmdChar}disconnect\n`;

  // spawn temp client to send shutdown command
  const client = spawn(serverPath, ["1", String(port), serverAddress]);

  // input commands to shutdown server and disconnect temp client
  client.stdin.write(shutdownCmd);
  client.stdin.write(disconnectCmd);

  // error checks
  client.on("error", (error) => {
    console.error("Failed to start client:", error);
    return res.status(500).send("Failed to start client");
  });

  client.stderr.once("data", (data) => {
    console.error(`Client Error: ${data}`);
    return res.status(500).send(`Client Error: ${data}`);
  });

  // output stream
  client.stdout.once("data", (data) => {
    console.log(`Client: ${data}`);
    client.kill();
    cmdChar = null;
    return res.status(200).send(`Server was shutdown`);
  });
});

module.exports = router;
