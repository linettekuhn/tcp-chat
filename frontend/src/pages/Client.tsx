import { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Tooltip,
  NumberInput,
  Badge,
  ActionIcon,
} from "@mantine/core";
import { startClient, stopClient, sendCommand } from "../api/tcpClient";
import { BASEURL } from "../api/config";
import Chatbox from "../components/Chatbox";
import { toast, ToastContainer } from "react-toastify";
import { MdHelpOutline } from "react-icons/md";
import CustomPasteButton from "../components/CustomPasteButton";
import { BiSend } from "react-icons/bi";

function Client() {
  const [port, setPort] = useState(31337);
  const [serverAddress, setServerAddress] = useState("");
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const recieveMessages = () => {
    if (abortRef.current) return;

    const abortController = new AbortController();
    abortRef.current = abortController;

    const connect = async () => {
      try {
        const response = await fetch(`${BASEURL}/client/output`, {
          signal: abortController.signal,
          headers: { Accept: "text/event-stream" },
        });

        console.log("SSE connected, status:", response.status);
        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }
        if (!response.body) {
          throw new Error("SSE response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("SSE stream done");
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          console.log("SSE raw chunk:", JSON.stringify(chunk));
          buffer += chunk;

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            for (const line of part.split("\n")) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                console.log(data);
                setMessages((prev) => [...prev, data]);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("SSE error:", err);
        }
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
      }
    };

    connect();
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
      console.log("SENDING:", command);
      await sendCommand(command);
      console.log("SEND succeeded, clearing input");
      setCommand("");
    } catch (error: unknown) {
      console.error("SEND error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const closeMessageStream = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  return (
    <Stack w="100%" h="100%" gap={0} style={{ overflow: "hidden" }}>
      <Stack
        align="stretch"
        p="xs"
        style={{
          background: "var(--color-tab-bar-background)",
          flexShrink: 0,
        }}
      >
        {!connected ? (
          <>
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
                  rightSectionWidth={36}
                  rightSection={
                    <CustomPasteButton
                      valueName="port"
                      onPaste={(text) => setPort(Number(text) || 0)}
                    />
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
                  rightSectionWidth={36}
                  rightSection={
                    <CustomPasteButton
                      valueName="IP"
                      onPaste={(text) => setServerAddress(text)}
                    />
                  }
                />
              </Stack>
              <Button onClick={handleClientStart} radius={0} c="black">
                JOIN_SERVER
              </Button>
            </Group>
          </>
        ) : (
          <Group h="100%" justify="space-between">
            <Badge variant="dot" color="green.4">
              Connected to {serverAddress}:{port} · You're not signed in
              yet{" "}
            </Badge>
            <Button
              onClick={handleClientStop}
              tt="uppercase"
              color="red.4"
              c="black"
              radius={0}
            >
              STOP_CLIENT
            </Button>
          </Group>
        )}
      </Stack>
      <Chatbox
        messages={
          connected
            ? [
                "(SERVER) You're connected. Sign in to start chatting.",
                "(SERVER) Use the buttons below to register a new account or log in.",
                ...messages,
              ]
            : ["(SERVER) Connect to a server to see the chat log here."]
        }
      >
        <Group
          p={16}
          w="100%"
          style={{ backgroundColor: "var(--color-tab-bar-background)" }}
        >
          <TextInput
            flex={1}
            radius={0}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendCommand();
            }}
            disabled={!connected}
          />
          <ActionIcon
            disabled={!connected}
            radius={0}
            c="black"
            onClick={handleSendCommand}
          >
            <BiSend />
          </ActionIcon>
        </Group>
      </Chatbox>
      <ToastContainer />
    </Stack>
  );
}
export default Client;
