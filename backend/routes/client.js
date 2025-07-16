const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const serverPath = path.join(__dirname, "../TCPChatServer.exe");

let client = null;
let cmdChar = null;

router.post("/start", (req, res) => {
  const { port, serverAddress } = req.body;

  if (!port || !serverAddress) {
    return res.status(400).send("Missing port or server IP address in request");
  }

  // client mode
  // TCPChatServer.exe 0 <port> <ip>
  client = spawn(serverPath, ["1", String(port), serverAddress]);

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
    const output = data.toString().replace(/\0/g, "").trim();
    cmdChar = output.charAt(output.length - 1);

    console.log(`Client: ${output}`);
    console.log(`Command char: ${cmdChar}`);
    return res.status(200).send(`Client: ${output}`);
  });
});

router.post("/command", (req, res) => {
  if (!client) {
    return res.status(400).send("Client not running");
  }

  let { command } = req.body;
  if (!command) {
    return res.status(400).send("Missing command in request");
  }
  command += "\n";

  // input command
  client.stdin.write(command);

  // error stream
  client.stderr.once("data", (data) => {
    console.error(`Command Error: ${data}`);
    return res.status(500).send(`Error: ${data}`);
  });

  // output stream
  client.stdout.once("data", (data) => {
    const output = data.toString().replace(/\0/g, "").trim();
    console.log(`Response: ${output}`);
    return res.status(200).send(output);
  });
});

router.post("/stop", (req, res) => {
  if (!client) {
    return res.status(400).send("Client not running");
  }

  // input command
  client.stdin.write(`${cmdChar}disconnect\n`);

  // error stream
  client.stderr.once("data", (data) => {
    console.error(`Client Error: ${data}`);
    return res.status(500).send(`Client Error: ${data}`);
  });

  // output stream
  client.stdout.once("data", (data) => {
    console.log(`Client: ${data}`);
    client.kill();
    client = null;
    cmdChar = null;
    return res.status(200).send("Client disconnected");
  });
});

module.exports = router;
