import { useState, useEffect } from "react";
import { startServer, stopServer, getHostIP } from "../../api/tcpServer";
import styles from "./Server.module.css";

function Server() {
  const [port, setPort] = useState(31337);
  const [capacity, setCapacity] = useState(10);
  const [commandChar, setCmdChar] = useState("~");
  const [serverAddress, setServerAddress] = useState("");
  const [isActive, setActive] = useState(false);
  const activeUsers: string[] = [];

  useEffect(() => {
    const fetchIP = async () => {
      const ip = await getHostIP();
      setServerAddress(ip);
    };

    fetchIP();
  }, []);
  const handleServerStart = async () => {
    await startServer(port, capacity, commandChar);
    setActive(true);
  };

  const handleServerStop = async () => {
    await stopServer(port, serverAddress);
    setActive(false);
  };

  // TODO: fetch active users
  return (
    <div className={`${styles.server} content`}>
      <form className={styles.serverOptions} action="server">
        <h1>Server Options</h1>
        <label htmlFor="port">
          <p>Port:</p>
          <input
            name="port"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </label>
        <label htmlFor="capacity">
          <p>Capacity:</p>
          <input
            name="capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </label>
        <label htmlFor="cmdChar">
          <p>Command Char:</p>
          <input
            name="cmdChar"
            type="text"
            value={commandChar}
            onChange={(e) => setCmdChar(e.target.value)}
          />
        </label>
        <label htmlFor="IP">
          <p>Server IP Address:</p>
          <input
            name="IP"
            type="text"
            value={serverAddress}
            onChange={(e) => {
              setServerAddress(e.target.value);
            }}
          />
        </label>
        <div className={styles.buttons}>
          <button disabled={isActive} type="button" onClick={handleServerStart}>
            Start Server
          </button>
          <button disabled={!isActive} type="button" onClick={handleServerStop}>
            Shutdown Server
          </button>
        </div>
      </form>
      <div className={styles.users}>
        <h2>Users</h2>
        <div className={styles.serverLog}>
          <p className={styles.serverStatus}>
            Server Status:
            {isActive ? (
              <p className="bold" style={{ color: "green" }}>
                Active
              </p>
            ) : (
              <p className="bold italic" style={{ color: "red" }}>
                Inactive
              </p>
            )}
          </p>
          <ul className={styles.activeUsers}>
            {activeUsers.length > 0 ? (
              activeUsers.map((user) => <li>{user}</li>)
            ) : (
              <li>No users</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
export default Server;
