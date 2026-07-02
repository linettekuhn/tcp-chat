const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const serverPath = path.join(__dirname, "../bin/TCPChatServer");
const shared = require("../shared-state");

const clients = new Map();

const cleanupClient = (clientId) => {
  const entry = clients.get(clientId);
  if (entry) {
    shared.clientProcesses.delete(entry.process);
    clients.delete(clientId);
  }
};

const killAllClients = () => {
  for (const [id, entry] of clients) {
    entry.process.kill();
  }
  clients.clear();
  shared.clientProcesses.clear();
};

process.on("SIGTERM", killAllClients);
process.on("SIGINT", killAllClients);

router.post("/start", (req, res) => {
  const { clientId, port, serverAddress } = req.body;

  if (!clientId || !port || !serverAddress) {
    return res.status(400).send("Missing clientId, port or server IP address in request");
  }

  if (clients.has(clientId)) {
    return res.status(400).send("Client already running");
  }

  const proc = spawn(serverPath, ["1", String(port), serverAddress]);
  const entry = { process: proc, cmdChar: null };
  clients.set(clientId, entry);
  shared.clientProcesses.add(proc);
  console.log(`[CLIENT ${clientId} PID] ${proc.pid}`);

  let responded = false;

  const errorHandler = (error, message) => {
    if (!responded) {
      console.error(`${message}:`, error);
      res.status(500).send(`${message}: ${error}`);
      responded = true;
      cleanupClient(clientId);
    }
  };

  proc.on("error", (error) => errorHandler(error, "Failed to start client"));

  proc.stderr.once("data", (data) =>
    errorHandler(data.toString(), "Client Error")
  );

  let stdoutBuffer = "";
  proc.stdout.on("data", (data) => {
    const text = data.toString().replace(/\0/g, "");
    console.log(`[CLIENT ${clientId} stdout] ${text.trim()}`);
    stdoutBuffer += text;
    const welcomeMatch = stdoutBuffer.match(/begin them with: (.)/);
    if (welcomeMatch && !responded) {
      entry.cmdChar = welcomeMatch[1];
      console.log(`Client ${clientId} command char: ${entry.cmdChar}`);
      res.status(200).send(`Client connected. Command character: ${entry.cmdChar}`);
      responded = true;
    }
  });

  proc.once("exit", (code) => {
    cleanupClient(clientId);
    if (!responded) {
      responded = true;
      console.error(`Client ${clientId} process exited unexpectedly with code ${code}`);
      res.status(500).send(`Client process exited unexpectedly with code ${code}`);
    }
  });
});

router.post("/command", (req, res) => {
  const { clientId, command } = req.body;

  if (!clientId) return res.status(400).send("Missing clientId in request");
  const entry = clients.get(clientId);
  if (!entry) return res.status(400).send("Client not running");

  if (!command) return res.status(400).send("Missing command in request");

  const fullCommand = command + "\n";
  let responded = false;

  const errorHandler = (message) => {
    if (!responded) {
      console.error(`Command Error: ${message}:`);
      res.status(500).send(`Command Error: ${message}:`);
      responded = true;
    }
  };

  const cmdErrorHandler = (data) => {
    const msg = data.toString();
    if (msg.startsWith("[CLIENT]")) {
      console.log("CLIENT DEBUG:", msg);
      return;
    }
    errorHandler(msg);
  };
  entry.process.stderr.on("data", cmdErrorHandler);

  const cleanup = () => entry.process.stderr.off("data", cmdErrorHandler);
  res.on("close", cleanup);

  try {
    entry.process.stdin.write(fullCommand, (error) => {
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
  const { clientId } = req.query;

  if (!clientId) return res.status(400).send("Missing clientId query parameter");
  const entry = clients.get(clientId);
  if (!entry) return res.status(400).send("Client not running");

  const currentEntry = entry;

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const outputHandler = (data) => {
    const output = data.toString().replace(/\0/g, "").trim();
    const formatted = output.replace(/\r?\n/g, "\n");
    const lines = formatted.split("\n");
    console.log(`Response [${clientId}]: ${output}`);
    for (const line of lines) {
      res.write(`data: ${line}\n`);
    }
    res.write("\n");
  };

  currentEntry.process.stdout.on("data", outputHandler);

  let closed = false;

  req.on("close", () => {
    if (!closed) {
      closed = true;
      console.log(`Client ${clientId} disconnected from SSE stream`);
      currentEntry.process.stdout.off("data", outputHandler);
      res.end();
    }
  });

  currentEntry.process.once("exit", (code) => {
    if (!closed) {
      closed = true;
      console.log(`Client ${clientId} process exited with code ${code}. Closing SSE stream`);
      currentEntry.process.stdout.off("data", outputHandler);
      res.end();
    }
  });
});

router.post("/stop", (req, res) => {
  const { clientId } = req.body;

  if (!clientId) return res.status(400).send("Missing clientId in request");
  const entry = clients.get(clientId);
  if (!entry) return res.status(400).send("Client not running");

  let responded = false;

  const errorHandler = (message) => {
    if (!responded) {
      console.error(`Client Error: ${message}:`);
      res.status(500).send(`Client Error: ${message}:`);
      responded = true;
    }
  };
  entry.process.stderr.once("data", (data) => errorHandler(data.toString()));

  const stopOutputHandler = (data) => {
    if (!responded) {
      console.log(`Client ${clientId}: ${data.toString().replace(/\0/g, "").trim()}`);
      entry.process.stdout.off("data", stopOutputHandler);

      setTimeout(() => {
        if (clients.has(clientId)) {
          console.log(`[CLIENT ${clientId} PID] killing ${entry.process.pid}`);
          entry.process.kill();
          cleanupClient(clientId);
          res.status(200).send("Client disconnected");
          responded = true;
        } else if (!responded) {
          res.status(500).send("Client already stopped unexpectedly");
          responded = true;
        }
      }, 100);
    }
  };
  entry.process.stdout.once("data", stopOutputHandler);

  entry.process.once("exit", (code) => {
    if (!responded) {
      console.log(`Client ${clientId} process exited with code ${code}`);
      cleanupClient(clientId);
      res.status(200).send("Client disconnected");
      responded = true;
    }
  });

  try {
    if (entry.cmdChar) {
      entry.process.stdin.write(`${entry.cmdChar}disconnect\n`, (error) => {
        if (error && !responded) {
          errorHandler(`Failed to write disconnect command: ${error.message}`);
        }
      });
    } else {
      if (!responded) {
        entry.process.kill();
        cleanupClient(clientId);
        res.status(200).send("Client disconnected");
        console.warn(`Null cmdChar for client ${clientId}. Force killed`);
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
