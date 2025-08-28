import { useEffect, useRef, useState } from "react";
import { startClient, stopClient, sendCommand } from "../../api/tcpClient";
import Message from "../components/Message";
import styles from "./Client.module.css";
import { IoSend } from "react-icons/io5";

function Client() {
  const [port, setPort] = useState(31337);
  const [serverAddress, setServerAddress] = useState("");
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleClientStart = async () => {
    await startClient(port, serverAddress);
    setConnected(true);
    recieveMessages();
  };

  const handleClientStop = async () => {
    closeMessageStream();
    await stopClient();
    setConnected(false);
    setMessages([]);
  };

  const handleSendCommand = async () => {
    await sendCommand(command);
  };

  const recieveMessages = () => {
    if (eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource(
      "https://tcp-chat-backend.onrender.com/client/output"
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      console.log(event.data);
      setMessages((prev) => [...prev, event.data]);
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      eventSource.close();
      eventSourceRef.current = null;
    };
  };

  const closeMessageStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className={`${styles.client} content`}>
      {!connected ? (
        <form className={styles.clientOptions} action="client">
          <h1>Connect to a Server</h1>
          <label htmlFor="port">
            <p>Port:</p>
            <input
              name="port"
              type="number"
              placeholder="31337"
              value={port}
              onChange={(e) => {
                setPort(Number(e.target.value));
              }}
            />
          </label>
          <label htmlFor="serverAddress">
            <p>Server IP Address:</p>
            <input
              name="serverAddress"
              type="text"
              placeholder="127.0.0.1"
              value={serverAddress}
              onChange={(e) => {
                setServerAddress(e.target.value);
              }}
            />
          </label>
          <button type="button" onClick={handleClientStart}>
            Connect
          </button>
        </form>
      ) : (
        <div className={styles.connectedClientView}>
          <button type="button" onClick={handleClientStop}>
            Stop Client
          </button>
          <div className={styles.chatbox}>
            <div className={styles.messages}>
              {messages.map((message: string, index: number) => (
                <Message key={index} msg={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className={styles.commandInput}>
              <input
                type="text"
                placeholder="Type in a command..."
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSendCommand();
                  }
                }}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleSendCommand}
              >
                <IoSend />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Client;
