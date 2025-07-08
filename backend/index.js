const express = require("express");
const app = express();
const { spawn } = require("node:child_process");

app.use(express.json());

app.listen(3000, () => {
  console.log("app listening on port 3000");
});

// server mode
// TCPChatServer.exe 0 <port> <capacity> <commandChar>
const server = spawn("TCPChatServer.exe", ["0", "31337", "10", "~"]);

// client mode
// Client: TCPChatServer.exe 1 <port>
const client = spawn("TCPChatServer.exe", ["1", "31337"]);
