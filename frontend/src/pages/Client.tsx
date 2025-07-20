import { useRef, useState } from "react";
import { startClient, stopClient, sendCommand } from "../../api/tcpClient";
import Message from "../components/Message";

function Client() {
  const [port, setPort] = useState(31337);
  const [serverAddress, setServerAddress] = useState("");
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleClientStart = async () => {
    await startClient(port, serverAddress);
    recieveMessages();
  };

  const handleClientStop = async () => {
    closeMessageStream();
    await stopClient();
    setMessages([]);
  };

  const handleSendCommand = async () => {
    await sendCommand(command);
  };

  const recieveMessages = () => {
    if (eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource("http://localhost:3000/client/output");
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

  return (
    <>
      <form action="client">
        <p>Port:</p>
        <input
          type="number"
          placeholder="31337"
          value={port}
          onChange={(e) => {
            setPort(Number(e.target.value));
          }}
        />
        <p>Server IP Address:</p>
        <input
          type="text"
          placeholder="127.0.0.1"
          value={serverAddress}
          onChange={(e) => {
            setServerAddress(e.target.value);
          }}
        />
        <button type="button" onClick={handleClientStart}>
          Start Client
        </button>
      </form>
      <button type="button" onClick={handleClientStop}>
        Stop Client
      </button>

      <input
        type="text"
        placeholder="Type in a command..."
        value={command}
        onChange={(e) => setCommand(e.target.value)}
      />
      <button type="button" onClick={handleSendCommand}>
        Send
      </button>

      <div className="chatbox">
        {messages.map((message: string, index: number) => (
          <Message key={index} msg={message} />
        ))}
      </div>
    </>
  );
}
export default Client;
