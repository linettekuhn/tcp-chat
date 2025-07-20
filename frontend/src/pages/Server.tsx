import { useState, useEffect } from "react";
import { startServer, stopServer, getHostIP } from "../../api/tcpServer";

function Server() {
  const [port, setPort] = useState(31337);
  const [capacity, setCapacity] = useState(10);
  const [commandChar, setCmdChar] = useState("~");
  const [serverAddress, setServerAddress] = useState("");

  useEffect(() => {
    const fetchIP = async () => {
      const ip = await getHostIP();
      setServerAddress(ip);
    };

    fetchIP();
  }, []);
  const handleServerStart = async () => {
    await startServer(port, capacity, commandChar);
  };

  const handleServerStop = async () => {
    await stopServer(port, serverAddress);
  };
  return (
    <>
      <form action="server">
        <p>Port:</p>
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(Number(e.target.value))}
        />
        <p>Capacity:</p>
        <input
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
        <p>Command Char:</p>
        <input
          type="text"
          value={commandChar}
          onChange={(e) => setCmdChar(e.target.value)}
        />
        <p>Server IP Address:</p>
        <input
          type="text"
          value={serverAddress}
          onChange={(e) => {
            setServerAddress(e.target.value);
          }}
        />
        <button type="button" onClick={handleServerStart}>
          Start Server
        </button>
      </form>
      <button type="button" onClick={handleServerStop}>
        Shutdown Server
      </button>
    </>
  );
}
export default Server;
