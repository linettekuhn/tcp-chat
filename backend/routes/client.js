const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const serverPath = path.join(__dirname, "../TCPChatServer.exe");

let client = null;
let cmdChar = null;

router.post("/start", (req, res) => {
  if (client) {
    return res.status(400).send("Client already running");
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

  // output stream
  client.stdout.once("data", (data) => {
    if (!responded) {
      const output = data.toString().replace(/\0/g, "").trim();
      cmdChar = output.charAt(output.length - 1);

      console.log(`Command char: ${cmdChar}`);
      res.status(200).send(`Client connected. Command character: ${cmdChar}`);
      responded = true;
    }
  });

  // handle process exiting during startup
  client.once("exit", (code) => {
    if (!responded && code !== 0) {
      errorHandler(
        `Process exited with code ${code}`,
        "Client process exited unexpectedly"
      );
    }
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

  let responded = false;

  const errorHandler = (message) => {
    if (!responded) {
      console.error(`Command Error: ${message}:`);
      res.status(500).send(`Command Error: ${message}:`);
      responded = true;
    }
  };

  // temp handler for command errors
  const cmdErrorHandler = (data) => {
    errorHandler(data.toString());
    // remove handler after error
    client.stderr.off("data", cmdErrorHandler);
  };
  client.stderr.once("data", cmdErrorHandler);

  try {
    // input command
    client.stdin.write(command, (error) => {
      if (error) {
        errorHandler(`Failed to write to stdin: ${error.message}`);
      } else if (!responded) {
        res.status(200).send("Command sent");
      }
    });
  } catch (error) {
    errorHandler(`Error caught writing to stdin stream: ${error.message}`);
  }
});

router.get("/output", (req, res) => {
  if (!client) {
    return res.status(400).send("Client not running");
  }

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
  client.stdout.on("data", outputHandler);

  let closed = false;

  // cleanup when client disconnects or request closes
  req.on("close", () => {
    if (!closed) {
      closed = true;
      console.log("Client disconnected from SSE stream");
      client.stdout.off("data", outputHandler);
      res.end();
    }
  });

  // cleanup if client process exits
  client.once("exit", (code) => {
    if (!closed) {
      closed = true;
      console.log(`Process exited with code ${code}. Closing SSE stream`);
      client.stdout.off("data", outputHandler);
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
