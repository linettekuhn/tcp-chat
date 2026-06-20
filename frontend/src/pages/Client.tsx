import { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Tooltip,
  NumberInput,
  ActionIcon,
} from "@mantine/core";
import { startClient, stopClient, sendCommand } from "../api/tcpClient";
import { BASEURL } from "../api/config";
import Message from "../components/Message";
import styles from "./Client.module.css";
import { IoSend } from "react-icons/io5";
import { toast, ToastContainer } from "react-toastify";
import { MdContentPaste, MdHelpOutline } from "react-icons/md";

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

    const eventSource = new EventSource(`${BASEURL}/client/output`);
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
        <Stack
          align="stretch"
          p="xs"
          flex={1}
          style={{
            background: "var(--color-tab-bar-background)",
          }}
        >
          <Text size="sm">
            Enter the server's IP address and port to join. You'll need to
            create an account or log in before you can send messages.
          </Text>
          <Group align="flex-end" gap="xl">
            <Stack gap="xs" style={{ flexShrink: 0 }}>
              <Tooltip label="The port number the server is listening on.">
                <Group
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    gap: 4,
                    flexWrap: "nowrap",
                  }}
                >
                  <Text fw={600} size="xs">
                    LISTENING_PORT
                  </Text>
                  <MdHelpOutline />
                </Group>
              </Tooltip>
              <NumberInput
                value={port}
                min={1024}
                max={65535}
                clampBehavior="strict"
                onChange={(value) => setPort(Number(value) || 0)}
                radius={0}
                hideControls
                rightSection={
                  <Tooltip label="Paste port" position="top" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="dimmed"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setPort(Number(text) || 0);
                          toast.success("Pasted!");
                        } catch {
                          toast.error("Failed to paste");
                        }
                      }}
                    >
                      <MdContentPaste size={14} />
                    </ActionIcon>
                  </Tooltip>
                }
              />
            </Stack>
            <Stack gap="xs" style={{ flexShrink: 0 }}>
              <Tooltip label="The IP address of the server you want to join.">
                <Group
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    gap: 4,
                    flexWrap: "nowrap",
                  }}
                >
                  <Text fw={600} size="xs">
                    SERVER_IP
                  </Text>
                  <MdHelpOutline />
                </Group>
              </Tooltip>
              <TextInput
                radius={0}
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                rightSection={
                  <Tooltip label="Paste IP" position="top" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="dimmed"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setServerAddress(text);
                          toast.success("Pasted!");
                        } catch {
                          toast.error("Failed to paste");
                        }
                      }}
                    >
                      <MdContentPaste size={14} />
                    </ActionIcon>
                  </Tooltip>
                }
              />
            </Stack>
            <Button onClick={handleClientStart} radius={0} c="black">
              JOIN_SERVER
            </Button>
          </Group>
        </Stack>
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
