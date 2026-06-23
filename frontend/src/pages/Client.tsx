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
  Modal,
  PasswordInput,
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
  const [commandChar, setCommandChar] = useState("~");
  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [authModalMode, setAuthModalMode] = useState<
    "register" | "login" | null
  >(null);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const pendingUsernameRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
            const dataLines: string[] = [];
            for (const line of part.split("\n")) {
              if (line.startsWith("data: ")) {
                dataLines.push(line.slice(6));
              }
            }
            if (dataLines.length === 0) continue;
            const data = dataLines.join("\n");
            console.log(data);
            const cmdCharMatch = data.match(/begin them with: (.)/);
            if (cmdCharMatch) setCommandChar(cmdCharMatch[1]);
            setMessages((prev) => [...prev, data]);
            if (data === "(SERVER) User logged in!") {
              setSignedIn(true);
              setUsername(pendingUsernameRef.current);
            } else if (data === "(SERVER) User logged out!") {
              setSignedIn(false);
              setUsername("");
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
      setSignedIn(false);
      setUsername("");
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
      setSignedIn(false);
      setUsername("");
      setMessages([]);
      toast.warning("Client stopped");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleSendCommand = async () => {
    const input = command.trim();
    const finalCommand = input.startsWith(commandChar)
      ? input
      : commandChar + input;
    const parts = finalCommand.split(/\s+/);
    if (
      parts.length >= 3 &&
      (parts[0] === `${commandChar}register` ||
        parts[0] === `${commandChar}login`)
    ) {
      pendingUsernameRef.current = parts[1];
    }
    try {
      console.log("SENDING:", finalCommand);
      await sendCommand(finalCommand);
      console.log("SEND succeeded, clearing input");
      setCommand("");
    } catch (error: unknown) {
      console.error("SEND error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const commandButtons = [
    { label: "register", cmd: "register", guestOnly: true },
    { label: "log in", cmd: "login", guestOnly: true },
    { label: "help", cmd: "help" },
    { label: "log out", cmd: "logout", auth: true },
    { label: "send", cmd: 'send ""', auth: true, cursorEnd: true },
    { label: "who's online", cmd: "getlist", auth: true },
    { label: "chat history", cmd: "getchatlog", auth: true },
    { label: "command history", cmd: "getcmdlog", auth: true },
  ];

  const handleCommandClick = (cmd: string, cursorEnd?: boolean) => {
    if (cmd === "register" || cmd === "login") {
      setAuthUsername("");
      setAuthPassword("");
      setAuthModalMode(cmd);
      return;
    }
    const full = commandChar + cmd;
    setCommand(full);
    inputRef.current?.focus();
    if (cursorEnd) {
      setTimeout(() => {
        inputRef.current?.focus();
        const pos = full.length - 1;
        inputRef.current?.setSelectionRange(pos, pos);
      }, 0);
    }
  };

  const handleAuthSubmit = () => {
    if (!authModalMode || !authUsername.trim() || !authPassword.trim()) return;
    const full = `${commandChar}${authModalMode} ${authUsername.trim()} ${authPassword.trim()}`;
    setCommand(full);
    setAuthModalMode(null);
    pendingUsernameRef.current = authUsername.trim();
    setTimeout(() => inputRef.current?.focus(), 0);
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
            <Badge variant="dot" color={signedIn ? "green.4" : "blue.4"}>
              Connected to {serverAddress}:{port} ·{" "}
              {signedIn
                ? `Signed in as ${username}`
                : "You're not signed in yet"}{" "}
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
            ? signedIn
              ? [
                  `(SERVER) You're in. Say something, or use the buttons below to see who's online.`,
                  ...messages,
                ]
              : [
                  "(SERVER) You're connected. Sign in to start chatting.",
                  "(SERVER) Use the buttons below to register a new account or log in.",
                  ...messages,
                ]
            : ["(SERVER) Connect to a server to see the chat log here."]
        }
      >
        <Stack
          gap={12}
          p={16}
          w="100%"
          style={{ backgroundColor: "var(--color-tab-bar-background)" }}
        >
          {connected && (
            <Group gap={4} wrap="wrap">
              {commandButtons
                .filter((b) => {
                  if (b.guestOnly && signedIn) return false;
                  if (b.auth && !signedIn) return false;
                  return true;
                })
                .map((b) => (
                  <Button
                    key={b.cmd}
                    size="xs"
                    variant="light"
                    radius="xl"
                    tt="uppercase"
                    onClick={() => handleCommandClick(b.cmd, b.cursorEnd)}
                  >
                    {b.label}
                  </Button>
                ))}
            </Group>
          )}
          <Group w="100%">
            <TextInput
              flex={1}
              radius={0}
              ref={inputRef}
              value={command}
              onChange={(e) => {
                const val = e.target.value;
                if (val && !val.startsWith(commandChar)) {
                  setCommand(commandChar + val);
                } else {
                  setCommand(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendCommand();
              }}
              disabled={!connected}
              styles={{ input: { fontFamily: "JetBrains Mono" } }}
              placeholder={
                connected
                  ? "Execute command or send message..."
                  : "Command input locked until server starts..."
              }
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
        </Stack>
      </Chatbox>
      <Modal
        opened={authModalMode !== null}
        onClose={() => setAuthModalMode(null)}
        title={
          authModalMode === "register"
            ? "Create register command"
            : "Create log in command"
        }
        tt="capitalize"
        styles={{ title: { fontWeight: 900 } }}
        centered
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAuthSubmit();
          }}
        >
          <Stack gap="sm">
            <TextInput
              label="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.currentTarget.value)}
              autoFocus
              required
            />
            <PasswordInput
              label="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.currentTarget.value)}
              required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setAuthModalMode(null)}>
                Cancel
              </Button>
              <Button variant="light" type="submit">
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <ToastContainer />
    </Stack>
  );
}
export default Client;
