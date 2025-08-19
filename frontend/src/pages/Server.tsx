import { useState, useEffect, useRef } from "react";
import { startServer, stopServer, getHostIP } from "../../api/tcpServer";
import styles from "./Server.module.css";
import { IoReload } from "react-icons/io5";
import {
  sendAdminCommand,
  startAdminClient,
  stopAdminClient,
} from "../../api/tcpServer";

function Server() {
  const [port, setPort] = useState(31337);
  const [capacity, setCapacity] = useState(10);
  const [commandChar, setCmdChar] = useState("~");
  const [serverAddress, setServerAddress] = useState("");
  const [isActive, setActive] = useState(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const fetchIP = async () => {
      const ip = await getHostIP();
      setServerAddress(ip);
    };

    fetchIP();
  }, []);

  const fetchActiveUsers = async () => {
    if (loadingUsers) return;
    setLoadingUsers(true);

    // recieve message until promise is resolved
    const promise = recieveMessages();

    // send commands to get list
    await sendAdminCommand(`${commandChar}register admin 123`);
    await sendAdminCommand(`${commandChar}login admin 123`);
    await sendAdminCommand(`${commandChar}getlist`);

    // wait for promise to be resolved and stop temp client
    await promise;
  };

  const recieveMessages = (): Promise<void> => {
    return new Promise((resolve) => {
      if (eventSourceRef.current) {
        resolve();
        return;
      }

      const eventSource = new EventSource(
        "http://localhost:3000/server/output-admin"
      );
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        console.log(event.data);

        if (event.data.startsWith("(SERVER) Logged in users:")) {
          const msgComponents = event.data.split(":");
          const users = msgComponents[1].split("\n");
          setActiveUsers(users);
          resolve();
        }
        if (event.data.startsWith("(SERVER) No users logged in")) {
          setActiveUsers([]);
          resolve();
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        eventSource.close();
        eventSourceRef.current = null;
        resolve();
      };
    });
  };

  const startAdmin = async () => {
    await startAdminClient(port, serverAddress);
  };

  const closeAdmin = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    await stopAdminClient();
  };

  const handleServerStart = async () => {
    await startServer(port, capacity, commandChar);
    await startAdmin();
    setActive(true);
  };

  const handleServerStop = async () => {
    await stopServer(port, serverAddress);
    await closeAdmin();
    setActive(false);
  };

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
          <div className={styles.serverStatus}>
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
            <IoReload
              onClick={fetchActiveUsers}
              style={{ cursor: "pointer" }}
            />
          </div>
          <ul className={styles.activeUsers}>
            {activeUsers.length > 0 ? (
              activeUsers.map((user) => <li key={user}>{user}</li>)
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
