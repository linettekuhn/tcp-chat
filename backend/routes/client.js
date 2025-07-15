const express = require("express");
const router = express.Router();

router.post("/start", () => {
  const { port, ip } = req.body;

  // client mode
  // Client: TCPChatServer.exe 1 <port>
  const client = spawn("TCPChatServer.exe", ["1", String(port), ip]);
});

router.post("/command", () => {
  // TODO: stdin
  // TODO: send response message back
});

router.post("/stop", () => {
  // TODO: shutdown socket
});

module.exports = router;
