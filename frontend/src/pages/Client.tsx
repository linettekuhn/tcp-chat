import { useEffect, useRef, useState } from "react";
import { startClient, stopClient, sendCommand } from "../api/tcpClient";
import Message from "../components/Message";
import styles from "./Client.module.css";
import { IoSend } from "react-icons/io5";
import { toast, ToastContainer } from "react-toastify";

function Client() {
  const [port, setPort] = useState(31337);
  const [serverAddress, setServerAddress] = useState("");
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const recieveMessages = () => {
    if (eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource(
      "https://api.tcp-chat.linettekuhn.com/client/output"
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      console.log(event.data);
      setMessages((prev) => [...prev, event.data]);
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      toast.error("SSE error");
      eventSource.close();
      eventSourceRef.current = null;
    };
  };

  const handleClientStart = async () => {
    try {
      await startClient(port, serverAddress);
      setConnected(true);
      recieveMessages();
      toast.success("Client started!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleClientStop = async () => {
    try {
      closeMessageStream();
      await stopClient();
      setConnected(false);
      setMessages([]);
      toast.warning("Client stopped");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleSendCommand = async () => {
    try {
      await sendCommand(command);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
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
    <main className={styles.client}>
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
      <ToastContainer />
    </main>
  );
}
export default Client;
