const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const serverPath = path.join(__dirname, "../bin/TCPChatServer");
const shared = require("../shared-state");

let client = null;
let cmdChar = null;

process.on("SIGTERM", () => { if (client) { client.kill(); shared.clientProcess = null; client = null; cmdChar = null; } });
process.on("SIGINT", () => { if (client) { client.kill(); shared.clientProcess = null; client = null; cmdChar = null; } });

router.post("/start", (req, res) => {
  if (client) {
    if (client.exitCode === null && client.signalCode === null) {
      return res.status(400).send("Client already running");
    }
    // orphaned reference — clean up
    shared.clientProcess = null;
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
  shared.clientProcess = client;
  console.log(`[CLIENT PID] ${client.pid}`);

  let responded = false;

  const errorHandler = (error, message) => {
    if (!responded) {
      console.error(`${message}:`, error);
      res.status(500).send(`${message}: ${error}`);
      responded = true;

      // cleanup client if error happens at startup
      if (client) {
        client.kill();
        shared.clientProcess = null;
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
    shared.clientProcess = null;
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
          console.log(`[CLIENT PID] killing ${client.pid}`);
          client.kill();
          shared.clientProcess = null;
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
      shared.clientProcess = null;
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
        shared.clientProcess = null;
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

router.get("/cmdlog/download", (req, res) => {
  const logPath = path.join(process.cwd(), "command_log.txt");
  if (!fs.existsSync(logPath)) {
    return res.json({ empty: true });
  }
  let content = fs.readFileSync(logPath, "utf-8");
  const tzOffset = parseInt(req.query.tzOffset, 10);
  if (!isNaN(tzOffset)) content = convertTimezone(content, tzOffset);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=command_log.txt");
  res.send(content);
});

router.get("/chatlog/download", (req, res) => {
  const logPath = path.join(process.cwd(), "chat_log.txt");
  if (!fs.existsSync(logPath)) {
    return res.json({ empty: true });
  }
  let content = fs.readFileSync(logPath, "utf-8");
  const tzOffset = parseInt(req.query.tzOffset, 10);
  if (!isNaN(tzOffset)) content = convertTimezone(content, tzOffset);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=chat_log.txt");
  res.send(content);
});

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_INDEX = Object.fromEntries(MONTH_NAMES.map((m, i) => [m, i]));
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TIMESTAMP_RE = /\[(\w{3}) (\w{3}) +(\d{1,2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) (AM|PM)\]/g;

function convertTimezone(content, tzOffset) {
  return content.replace(TIMESTAMP_RE, (match, _day, month, dayNum, year, hours, mins, secs, ampm) => {
    let h = parseInt(hours, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    const utcMs = Date.UTC(
      parseInt(year, 10), MONTH_INDEX[month], parseInt(dayNum, 10),
      h, parseInt(mins, 10), parseInt(secs, 10)
    );

    const d = new Date(utcMs - tzOffset * 60000);

    const h12 = d.getUTCHours() % 12 || 12;
    const newAmpm = d.getUTCHours() >= 12 ? 'PM' : 'AM';

    return `[${DAY_NAMES[d.getUTCDay()]} ${MONTH_NAMES[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${d.getUTCFullYear()} ${String(h12).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')} ${newAmpm}]`;
  });
}

module.exports = router;
