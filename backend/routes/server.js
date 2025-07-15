const express = require("express");
const router = express.Router();
const net = require("node:net");
const { spawn } = require("child_process");
const path = require("path");

let cmdChar = null;
router.post("/start", (req, res) => {
  const { port, capacity, commandChar } = req.body;
  cmdChar = commandChar;

  const serverPath = path.join(__dirname, "../TCPChatServer.exe");
  // server mode
  // TCPChatServer.exe 0 <port> <capacity> <commandChar>
  const server = spawn(serverPath, [
    "0",
    String(port),
    String(capacity),
    String(commandChar),
  ]);

  // TODO: send http error code on response
  server.stderr.on("data", (data) => {
    console.error(`Server Error: ${data}`);
  });

  let responded = false;
  server.stdout.on("data", (data) => {
    if (!responded) {
      responded = true;
      res.send(`Server: ${data}`);
      console.log(`Server: ${data}`);
    }
  });
});

router.post("/stop", (req, res) => {
  const { port, serverAddress } = req.body;
  const shutdownCmd = `${cmdChar}shutdown\n`;
  const disconnectCmd = `${cmdChar}disconnect\n`;

  const client = spawn("TCPChatServer.exe", ["1", String(port), serverAddress]);
  client.stdin.write(shutdownCmd);
  client.stdin.write(disconnectCmd);

  let responded = false;

  // TODO: send http error code on response
  client.stderr.on("data", (data) => {
    if (!responded) {
      responded = true;
      res.send(`Client Error: ${data}`);
    }
    console.error(`Client Error: ${data}`);
  });

  client.stdout.on("data", (data) => {
    if (!responded) {
      responded = true;
      res.send(`Server was shutdown`);
    }
    console.log(`Client: ${data}`);
  });
});

module.exports = router;
