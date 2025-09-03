import { useState, useEffect, useRef } from "react";
import { startServer, stopServer, getHostIP } from "../../api/tcpServer";
import styles from "./Server.module.css";
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
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const fetchIP = async () => {
      const ip = await getHostIP();
      setServerAddress(ip);
    };

    fetchIP();
  }, []);

  const recieveMessages = (): Promise<void> => {
    return new Promise((resolve) => {
      if (eventSourceRef.current) {
        resolve();
        return;
      }

      const eventSource = new EventSource(
        "https://tcp-chat-backend.onrender.com/server/output-admin"
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

  useEffect(() => {
    const fetchActiveUsers = async () => {
      // recieve message until promise is resolved
      const promise = recieveMessages();

      // send commands to get list
      await sendAdminCommand(`${commandChar}getlist`);

      // wait for promise to be resolved and stop temp client
      await promise;
    };

    if (isActive) {
      fetchActiveUsers();

      // call fetch active users function every 5 seconds
      const interval = setInterval(() => {
        fetchActiveUsers();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isActive, commandChar]);

  const startAdmin = async () => {
    await startAdminClient(port, serverAddress);
    await sendAdminCommand(`${commandChar}register admin 123`);
    await sendAdminCommand(`${commandChar}login admin 123`);
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
    <main className={styles.server}>
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
    </main>
  );
}
export default Server;
