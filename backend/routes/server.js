const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const serverPath = path.join(__dirname, "../bin/TCPChatServer");
const os = require("os");

let cmdChar = null;
let admin = null;

router.get("/debug-binary", (req, res) => {
  const fs = require("fs");
  const path = require("path");
  const { execSync } = require("child_process");

  const serverPath = path.join(__dirname, "../bin/TCPChatServer");

  try {
    const stats = fs.statSync(serverPath);
    const fileInfo = {
      exists: fs.existsSync(serverPath),
      isFile: stats.isFile(),
      permissions: stats.mode.toString(8),
      size: stats.size,
    };

    // Try to run the binary with --help or similar to see if it works
    try {
      const output = execSync(
        `${serverPath} --help 2>&1 || echo "No help available"`,
        { encoding: "utf8" }
      );
      fileInfo.testOutput = output;
    } catch (err) {
      fileInfo.testError = err.message;
    }

    res.json(fileInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-simple", (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const debugInfo = {
    cwd: process.cwd(),
    __dirname: __dirname,

    // Check current directory contents recursively
    allFiles: [],
  };

  function findFiles(dir, prefix = "") {
    try {
      const items = fs.readdirSync(dir);
      items.forEach((item) => {
        const fullPath = path.join(dir, item);
        const relativePath = prefix + item;

        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory() && !item.includes("node_modules")) {
            debugInfo.allFiles.push(`${relativePath}/`);
            findFiles(fullPath, relativePath + "/");
          } else if (stat.isFile()) {
            debugInfo.allFiles.push(relativePath);
          }
        } catch (e) {
          // Skip files we can't read
        }
      });
    } catch (e) {
      // Skip directories we can't read
    }
  }

  findFiles(process.cwd());

  res.json(debugInfo);
});

router.get("/debug-files", (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const debugInfo = {
    cwd: process.cwd(),
    __dirname: __dirname,
    expectedPath: path.join(__dirname, "../bin/TCPChatServer"),

    // Check what's in the backend directory
    backendDir: fs.existsSync("./backend")
      ? fs.readdirSync("./backend")
      : "backend dir not found",

    // Check what's in the bin directory
    binDir: fs.existsSync("./backend/bin")
      ? fs.readdirSync("./backend/bin")
      : "bin dir not found",

    // Check root directory contents
    rootDir: fs.readdirSync("./"),
  };

  res.json(debugInfo);
});

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

router.get("/host-ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  let address = "127.0.0.1";

  // loop thru network interfaces
  for (const name in interfaces) {
    for (const interface of interfaces[name]) {
      // find first non-internal ipv4 ip address
      if (
        interface.family === "IPv4" &&
        interface.address !== "127.0.0.1" &&
        !interface.internal
      ) {
        address = interface.address;
        break;
      }
    }
  }
  return res.status(200).send(address);
});

router.post("/start-admin", (req, res) => {
  if (admin) {
    return res.status(400).send("Admin client already running");
  }
  const { port, serverAddress } = req.body;

  if (!port || !serverAddress) {
    return res.status(400).send("Missing port or server IP address in request");
  }

  // spawn process in client mode
  // TCPChatServer.exe 0 <port> <ip>
  admin = spawn(serverPath, ["1", String(port), serverAddress]);

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
    errorHandler(data.toString(), "Admin client Error")
  );

  // output stream
  admin.stdout.once("data", (data) => {
    if (!responded) {
      const output = data.toString().replace(/\0/g, "").trim();
      cmdChar = output.charAt(output.length - 1);

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
        "Admin client process exited unexpectedly"
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

  // temp handler for command errors
  const cmdErrorHandler = (data) => {
    errorHandler(data.toString());
    // remove handler after error
    admin.stderr.off("data", cmdErrorHandler);
  };
  admin.stderr.once("data", cmdErrorHandler);

  try {
    // input command
    admin.stdin.write(command, (error) => {
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

router.get("/output-admin", (req, res) => {
  if (!admin) {
    return res.status(400).send("Admin client not running");
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
  admin.stdout.on("data", outputHandler);

  let closed = false;

  // cleanup when admin disconnects or request closes
  req.on("close", () => {
    if (!closed) {
      closed = true;
      console.log("Admin client disconnected from SSE stream");
      admin.stdout.off("data", outputHandler);
      res.end();
    }
  });

  // cleanup if admin process exits
  admin.once("exit", (code) => {
    if (!closed) {
      closed = true;
      console.log(`Process exited with code ${code}. Closing SSE stream`);
      admin.stdout.off("data", outputHandler);
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
