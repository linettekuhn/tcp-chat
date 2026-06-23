const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const serverPath = path.join(__dirname, "../bin/TCPChatServer");

let client = null;
let cmdChar = null;

process.on("SIGTERM", () => { if (client) { client.kill(); client = null; cmdChar = null; } });
process.on("SIGINT", () => { if (client) { client.kill(); client = null; cmdChar = null; } });

router.post("/start", (req, res) => {
  if (client) {
    if (client.exitCode === null && client.signalCode === null) {
      return res.status(400).send("Client already running");
    }
    // orphaned reference — clean up
    client = null;
    cmdChar = null;
  }
  const { port, serverAddress } = req.body;

  if (!port || !serverAddress) {
    return res.status(400).send("Missing port or server IP address in request");
  }

  // spawn process in client mode
  // TCPChatServer.exe 0 <port> <ip>
  client = spawn(serverPath, ["1", String(port), serverAddress]);

  let responded = false;

  const errorHandler = (error, message) => {
    if (!responded) {
      console.error(`${message}:`, error);
      res.status(500).send(`${message}: ${error}`);
      responded = true;

      // cleanup client if error happens at startup
      if (client) {
        client.kill();
        client = null;
        cmdChar = null;
      }
    }
  };

  // error checks
  client.on("error", (error) => errorHandler(error, "Failed to start client"));

  client.stderr.once("data", (data) =>
    errorHandler(data.toString(), "Client Error")
  );

  // output stream — buffer data and look for welcome message to extract cmdChar
  let stdoutBuffer = "";
  client.stdout.on("data", (data) => {
    const text = data.toString().replace(/\0/g, "");
    console.log(`[CLIENT stdout] ${text.trim()}`);
    stdoutBuffer += text;
    const welcomeMatch = stdoutBuffer.match(/begin them with: (.)/);
    if (welcomeMatch && !responded) {
      cmdChar = welcomeMatch[1];
      console.log(`Command char: ${cmdChar}`);
      res.status(200).send(`Client connected. Command character: ${cmdChar}`);
      responded = true;
    }
  });

  // clean up reference when process exits
  client.once("exit", (code) => {
    client = null;
    cmdChar = null;
    if (!responded) {
      responded = true;
      console.error(`Client process exited unexpectedly with code ${code}`);
      res.status(500).send(`Client process exited unexpectedly with code ${code}`);
    }
  });
});

router.post("/command", (req, res) => {
  if (!client) {
    return res.status(400).send("Client not running");
  }

  let { command } = req.body;
  console.log("COMMAND received:", command);
  if (!command) {
    return res.status(400).send("Missing command in request");
  }
  command += "\n";

  let responded = false;

  const errorHandler = (message) => {
    if (!responded) {
      console.error(`Command Error: ${message}:`);
      res.status(500).send(`Command Error: ${message}:`);
      responded = true;
    }
  };

  // handler for stderr output
  const cmdErrorHandler = (data) => {
    const msg = data.toString();
    if (msg.startsWith("[CLIENT]")) {
      console.log("CLIENT DEBUG:", msg);
      return; // debug logs are not errors
    }
    errorHandler(msg);
  };
  client.stderr.on("data", cmdErrorHandler);

  // clean up listener when request completes
  const cleanup = () => client.stderr.off("data", cmdErrorHandler);
  res.on("close", cleanup);

  try {
    // input command
    client.stdin.write(command, (error) => {
      if (error) {
        errorHandler(`Failed to write to stdin: ${error.message}`);
      } else if (!responded) {
        console.log("COMMAND written to stdin successfully");
        res.status(200).send("Command sent");
      }
      cleanup();
    });
  } catch (error) {
    errorHandler(`Error caught writing to stdin stream: ${error.message}`);
  }
});

router.get("/output", (req, res) => {
  if (!client) {
    return res.status(400).send("Client not running");
  }

  // capture local reference so event callbacks aren't affected
  // if the module-level client variable is mutated later
  const currentClient = client;

  // treat response as server-side event (SSE) stream
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  // handler to send messages from output stream to frontend
  const outputHandler = (data) => {
    const output = data.toString().replace(/\0/g, "").trim();
    const formatted = output.replace(/\r?\n/g, "\n");
    const lines = formatted.split("\n");
    console.log(`Response: ${output}`);
    for (const line of lines) {
      res.write(`data: ${line}\n`);
    }
    res.write("\n");
  };

  // call handler on data recieved
  currentClient.stdout.on("data", outputHandler);

  let closed = false;

  // cleanup when client disconnects or request closes
  req.on("close", () => {
    if (!closed) {
      closed = true;
      console.log("Client disconnected from SSE stream");
      currentClient.stdout.off("data", outputHandler);
      res.end();
    }
  });

  // cleanup if client process exits
  currentClient.once("exit", (code) => {
    if (!closed) {
      closed = true;
      console.log(`Process exited with code ${code}. Closing SSE stream`);
      currentClient.stdout.off("data", outputHandler);
      res.end();
    }
  });
});

router.post("/stop", (req, res) => {
  if (!client) {
    return res.status(400).send("Client not running");
  }

  let responded = false;

  // error handler
  const errorHandler = (message) => {
    if (!responded) {
      console.error(`Client Error: ${message}:`);
      res.status(500).send(`Client Error: ${message}:`);
      responded = true;
    }
  };
  client.stderr.once("data", (data) => errorHandler(data.toString()));

  // handler for output from stop operation
  const stopOutputHandler = (data) => {
    if (!responded) {
      console.log(`Client: ${data.toString().replace(/\0/g, "").trim()}`);
      client.stdout.off("data", stopOutputHandler);

      setTimeout(() => {
        if (client) {
          client.kill();
          client = null;
          cmdChar = null;
          res.status(200).send("Client disconnected");
          responded = true;
        } else if (!responded) {
          res.status(500).send("Client already stopped unexpectedly");
          responded = true;
        }
      }, 100);
    }
  };
  client.stdout.once("data", stopOutputHandler);

  // cleanup if client process exits
  client.once("exit", (code) => {
    if (!responded) {
      console.log(`Process exited with code ${code}`);
      client = null;
      cmdChar = null;
      res.status(200).send("Client disconnected");
      responded = true;
    }
  });

  // try to disconnect client (thru cmd or forced)
  try {
    if (cmdChar) {
      // input command to disconnect
      client.stdin.write(`${cmdChar}disconnect\n`, (error) => {
        if (error && !responded) {
          errorHandler(`Failed to write disconnect command: ${error.message}`);
        }
      });
    } else {
      if (!responded) {
        client.kill();
        client = null;
        cmdChar = null;
        res.status(200).send("Client disconnected");
        console.warn("Null cmdChar. Client force killed");
        responded = true;
      }
    }
  } catch (error) {
    errorHandler(`Error caught writing to stdin stream: ${error.message}`);
  }
});

module.exports = router;
