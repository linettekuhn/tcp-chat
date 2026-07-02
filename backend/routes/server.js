const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const serverPath = path.join(__dirname, "../bin/TCPChatServer");
const os = require("os");
const shared = require("../shared-state");

let cmdChar = null;
let admin = null;
let serverProcess = null;

const killServerProcess = () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
};

const waitAndKillServer = () => {
  if (!serverProcess) return Promise.resolve();
  return new Promise((resolve) => {
    const p = serverProcess;
    serverProcess = null;
    p.once("exit", () => resolve());
    p.kill("SIGTERM");
  });
};

const killAdmin = () => {
  if (admin) {
    admin.kill();
    admin = null;
    cmdChar = null;
  }
};

process.on("SIGTERM", () => { killServerProcess(); killAdmin(); });
process.on("SIGINT", () => { killServerProcess(); killAdmin(); });

router.post("/start", async (req, res) => {
  // kill any orphaned processes from a previous session
  killAdmin();
  await waitAndKillServer();

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

  serverProcess = server;
  console.log(`[SERVER PID] ${server.pid}`);

  let responded = false;

  // error checks
  server.on("error", (error) => {
    if (!responded) {
      responded = true;
      console.error("Failed to start server:", error);
      res.status(500).send("Failed to start server");
    }
  });

  server.stderr.once("data", (data) => {
    if (!responded) {
      responded = true;
      console.error(`Server Error: ${data}`);
      res.status(500).send(`Server Error: ${data}`);
    }
  });

  // log all server stdout
  server.stdout.on("data", (data) => {
    console.log(`[SERVER stdout] ${data.toString().replace(/\0/g, "").trim()}`);
  });

  // output stream (first data = startup response)
  server.stdout.once("data", (data) => {
    if (!responded) {
      responded = true;
      console.log(`Server: ${data}`);
      res.status(200).send(`Server: ${data}`);
    }
  });

  // handle process exiting without producing output (e.g. init failure)
  server.once("exit", (code) => {
    if (serverProcess === server) serverProcess = null;
    if (!responded) {
      responded = true;
      console.error(`Server process exited unexpectedly with code ${code}`);
      res
        .status(500)
        .send(`Server process exited unexpectedly with code ${code}`);
    }
  });
});

router.post("/stop", (req, res) => {
  const { port, serverAddress } = req.body;
  if (!port || !serverAddress) {
    return res
      .status(400)
      .send("Missing port or server IP address in request.");
  }

  let responded = false;

  const finish = () => {
    if (!responded) {
      responded = true;
      cmdChar = null;
      serverProcess = null;
      for (const proc of shared.clientProcesses) {
        proc.kill("SIGTERM");
      }
      shared.clientProcesses.clear();
      res.status(200).send("Server was shutdown");
    }
  };

  // primary path: send shutdown through the already connected admin client
  if (admin && cmdChar) {
    admin.stdin.write(`${cmdChar}shutdown\n`);

    let pending = 0;
    const tryFinish = () => {
      if (--pending <= 0) {
        admin = null;
        serverProcess = null;
        finish();
      }
    };

    pending++;
    admin.once("exit", () => {
      admin = null;
      tryFinish();
    });

    if (serverProcess) {
      pending++;
      serverProcess.once("exit", () => {
        serverProcess = null;
        tryFinish();
      });
    }

    // safety timeout: force-kill both if they don't exit
    setTimeout(() => {
      if (admin) admin.kill();
      if (serverProcess) serverProcess.kill();
      admin = null;
      serverProcess = null;
      finish();
    }, 5000);

    return;
  }

  // fallback path: spawn a temporary client
  const client = spawn(serverPath, ["1", String(port), serverAddress]);
  client.stdin.write(`${cmdChar || ""}shutdown\n`);

  client.on("error", (error) => {
    if (!responded) {
      responded = true;
      cmdChar = null;
      res.status(500).send("Failed to start client: " + error.message);
    }
  });

  client.on("exit", () => {
    finish();
  });

  // safety timeout: force-kill temp client if it doesn't exit
  setTimeout(() => {
    client.kill();
    finish();
  }, 3000);
});

router.get("/host-ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  let address = "127.0.0.1";

  // loop thru network interfaces
  for (const name in interfaces) {
    for (const netInterface of interfaces[name]) {
      // find first non-internal ipv4 ip address
      if (
        netInterface.family === "IPv4" &&
        netInterface.address !== "127.0.0.1" &&
        !netInterface.internal
      ) {
        address = netInterface.address;
        break;
      }
    }
  }
  return res.status(200).send(address);
});

router.post("/start-admin", (req, res) => {
  if (admin) {
    if (admin.exitCode === null && admin.signalCode === null) {
      return res.status(400).send("Admin client already running");
    }
    // orphaned reference — clean up
    admin = null;
    cmdChar = null;
  }
  const { port, serverAddress } = req.body;

  if (!port || !serverAddress) {
    return res.status(400).send("Missing port or server IP address in request");
  }

  // spawn process in client mode
  // TCPChatServer.exe 0 <port> <ip>
  admin = spawn(serverPath, ["1", String(port), serverAddress]);
  console.log(`[ADMIN PID] ${admin.pid}`);

  let responded = false;

  const errorHandler = (error, message) => {
    if (!responded) {
      console.error(`${message}:`, error);
      res.status(500).send(`${message}: ${error}`);
      responded = true;

      // cleanup admin if error happens at startup
      if (admin) {
        admin.kill();
        admin = null;
        cmdChar = null;
      }
    }
  };

  // error checks
  admin.on("error", (error) => errorHandler(error, "Failed to start admin"));

  admin.stderr.once("data", (data) =>
    errorHandler(data.toString(), "Admin client Error"),
  );

  // output stream — buffer data and look for welcome message to extract cmdChar
  let stdoutBuffer = "";
  admin.stdout.on("data", (data) => {
    const text = data.toString().replace(/\0/g, "");
    console.log(`[ADMIN stdout] ${text.trim()}`);
    stdoutBuffer += text;
    const welcomeMatch = stdoutBuffer.match(/begin them with: (.)/);
    if (welcomeMatch && !responded) {
      cmdChar = welcomeMatch[1];
      console.log(`Command char: ${cmdChar}`);
      res
        .status(200)
        .send(`Admin client connected. Command character: ${cmdChar}`);
      responded = true;
    }
  });

  // handle process exiting during startup
  admin.once("exit", (code) => {
    if (!responded && code !== 0) {
      errorHandler(
        `Process exited with code ${code}`,
        "Admin client process exited unexpectedly",
      );
    }
  });
});

router.post("/command-admin", (req, res) => {
  if (!admin) {
    return res.status(400).send("Admin client not running");
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

  // handler for stderr output
  const cmdErrorHandler = (data) => {
    const msg = data.toString();
    if (msg.startsWith("[CLIENT]")) {
      console.log("CLIENT DEBUG:", msg);
      return; // debug logs are not errors
    }
    errorHandler(msg);
  };
  admin.stderr.on("data", cmdErrorHandler);

  // clean up listener when request completes
  const cleanup = () => admin.stderr.off("data", cmdErrorHandler);
  res.on("close", cleanup);

  try {
    // input command
    admin.stdin.write(command, (error) => {
      if (error) {
        // "stream was destroyed" is expected during restart — not an error
        if (error.message.includes("stream was destroyed")) {
          if (!responded) {
            responded = true;
            res.status(200).send("Command sent");
          }
        } else {
          errorHandler(`Failed to write to stdin: ${error.message}`);
        }
      } else if (!responded) {
        res.status(200).send("Command sent");
      }
      cleanup();
    });
  } catch (error) {
    errorHandler(`Error caught writing to stdin stream: ${error.message}`);
  }
});

router.get("/output-admin", (req, res) => {
  if (!admin) {
    return res.status(400).send("Admin client not running");
  }

  // capture local reference so event callbacks aren't affected
  // if the module-level admin variable is mutated later
  const currentAdmin = admin;

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
  currentAdmin.stdout.on("data", outputHandler);

  let closed = false;

  // cleanup when admin disconnects or request closes
  req.on("close", () => {
    if (!closed) {
      closed = true;
      console.log("Admin client disconnected from SSE stream");
      currentAdmin.stdout.off("data", outputHandler);
      res.end();
    }
  });

  // cleanup if admin process exits
  currentAdmin.once("exit", (code) => {
    if (!closed) {
      closed = true;
      console.log(`Process exited with code ${code}. Closing SSE stream`);
      currentAdmin.stdout.off("data", outputHandler);
      res.end();
    }
  });
});

router.post("/stop-admin", (req, res) => {
  if (!admin) {
    return res.status(400).send("Admin client not running");
  }

  let responded = false;

  // error handler
  const errorHandler = (message) => {
    if (!responded) {
      console.error(`Admin client Error: ${message}:`);
      res.status(500).send(`Admin client Error: ${message}:`);
      responded = true;
    }
  };
  admin.stderr.once("data", (data) => errorHandler(data.toString()));

  // handler for output from stop operation
  const stopOutputHandler = (data) => {
    if (!responded) {
      console.log(`Admin client: ${data.toString().replace(/\0/g, "").trim()}`);
      admin.stdout.off("data", stopOutputHandler);

      setTimeout(() => {
        if (admin) {
          admin.kill();
          admin = null;
          cmdChar = null;
          res.status(200).send("Admin client disconnected");
          responded = true;
        } else if (!responded) {
          res.status(500).send("Admin client already stopped unexpectedly");
          responded = true;
        }
      }, 100);
    }
  };
  admin.stdout.once("data", stopOutputHandler);

  // cleanup if admin process exits
  admin.once("exit", (code) => {
    if (!responded) {
      console.log(`Process exited with code ${code}`);
      admin = null;
      cmdChar = null;
      res.status(200).send("Admin client disconnected");
      responded = true;
    }
  });

  // try to disconnect admin (thru cmd or forced)
  try {
    if (cmdChar) {
      // input command to disconnect
      admin.stdin.write(`${cmdChar}disconnect\n`, (error) => {
        if (error && !responded) {
          errorHandler(`Failed to write disconnect command: ${error.message}`);
        }
      });
    } else {
      if (!responded) {
        admin.kill();
        admin = null;
        cmdChar = null;
        res.status(200).send("Admin client disconnected");
        console.warn("Null cmdChar. Admin client force killed");
        responded = true;
      }
    }
  } catch (error) {
    errorHandler(`Error caught writing to stdin stream: ${error.message}`);
  }
});

module.exports = router;
