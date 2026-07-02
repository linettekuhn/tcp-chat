import { useEffect, useRef, useState, type ComponentType } from "react";
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
  Drawer,
  Divider,
} from "@mantine/core";
import { startClient, stopClient, sendCommand } from "../api/tcpClient";
import { BASEURL } from "../api/config";
import Chatbox from "../components/Chatbox";
import { parseChatMessage, type ChatMessage } from "../types";
import { toast } from "react-toastify";
import {
  MdHelpOutline,
  MdOutlinePeopleAlt,
  MdOutlineTerminal,
} from "react-icons/md";
import { BiServer, BiSend } from "react-icons/bi";
import CustomCopyButton from "../components/CustomCopyButton";
import CustomPasteButton from "../components/CustomPasteButton";
import { useServerContext } from "../context/ServerContext";

function HeadingText({
  text,
  IconComponent,
}: {
  text: string;
  IconComponent: ComponentType<object>;
}) {
  return (
    <Group
      justify="flex-start"
      gap={8}
      style={{ color: "var(--mantine-primary-color-filled)" }}
    >
      <IconComponent />
      <Text size="sm" tt="uppercase" fw={600}>
        {text}
      </Text>
    </Group>
  );
}

function Client() {
  const {
    isActive,
    port: serverPort,
    capacity,
    commandChar: serverCmdChar,
    serverAddress: serverIP,
    activeUsers,
    inactiveUsers,
    loading,
    handleServerStop,
  } = useServerContext();

  const clientId = useRef(crypto.randomUUID()).current;
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [port, setPort] = useState(31337);
  const [serverAddress, setServerAddress] = useState("");
  const [command, setCommand] = useState("");
  const [commandChar, setCommandChar] = useState("~");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
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
      let disconnectedIntentionally = false;
      try {
        const response = await fetch(`${BASEURL}/client/output?clientId=${clientId}`, {
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
            const parsed = parseChatMessage(data);
            if (parsed) setMessages((prev) => [...prev, parsed]);
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
        if (err instanceof Error && err.name === "AbortError") {
          disconnectedIntentionally = true;
        } else {
          console.error("SSE error:", err);
        }
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
        if (!disconnectedIntentionally) {
          setConnected(false);
          setSignedIn(false);
          setUsername("");
          setMessages([]);
          toast.warning("Disconnected from server");
        }
      }
    };

    connect();
  };

  const handleClientStart = async () => {
    setClientLoading(true);
    try {
      const msg = await startClient(port, serverAddress, clientId);
      const match = msg.match(/Command character: (.)/);
      if (match) setCommandChar(match[1]);
      setConnected(true);
      setSignedIn(false);
      setUsername("");
      recieveMessages();
      toast.success("Client started!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setClientLoading(false);
    }
  };

  const handleClientStop = async () => {
    setClientLoading(true);
    try {
      closeMessageStream();
      await stopClient(clientId);
      setConnected(false);
      setSignedIn(false);
      setUsername("");
      setMessages([]);
      toast.info("Client stopped");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setClientLoading(false);
    }
  };

  const handleSendCommand = async () => {
    const input = command.trim();
    if (!input) return;
    let finalCommand: string;
    if (signedIn) {
      finalCommand = input.startsWith(commandChar)
        ? input
        : `${commandChar}send "${input}"`;
    } else {
      finalCommand = input.startsWith(commandChar)
        ? input
        : commandChar + input;
    }
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
      await sendCommand(finalCommand, clientId);
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
    { label: "who's online", cmd: "getlist", auth: true },
    { label: "chat history", cmd: "getchatlog", auth: true, download: true },
    { label: "command history", cmd: "getcmdlog", auth: true, download: true },
  ];

  const downloadLog = async (type: "cmdlog" | "chatlog") => {
    try {
      const response = await fetch(
        `${BASEURL}/client/${type}/download?tzOffset=${new Date().getTimezoneOffset()}`,
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }
      const data = await response
        .clone()
        .json()
        .catch(() => null);
      if (data?.empty) {
        toast.warn("Nothing has shown up in the chat yet");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type === "cmdlog" ? "command_log" : "chat_log"}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${type === "cmdlog" ? "Command" : "Chat"} log downloaded`);
    } catch (error) {
      toast.error(
        "Failed to download log: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  };

  const handleCommandClick = async (cmd: string, download?: boolean) => {
    if (download) {
      downloadLog(cmd.replace("get", "") as "cmdlog" | "chatlog");
      return;
    }
    if (cmd === "register" || cmd === "login") {
      setAuthUsername("");
      setAuthPassword("");
      setAuthModalMode(cmd);
      return;
    }
    const full = commandChar + cmd;
    setCommand(full);
    try {
      await sendCommand(full, clientId);
      setCommand("");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleAuthSubmit = async () => {
    if (!authModalMode || !authUsername.trim() || !authPassword.trim()) return;
    const full = `${commandChar}${authModalMode} ${authUsername.trim()} ${authPassword.trim()}`;
    setAuthModalMode(null);
    pendingUsernameRef.current = authUsername.trim();
    try {
      await sendCommand(full, clientId);
      setCommand("");
    } catch (error: unknown) {
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

  const prevIsActiveRef = useRef(isActive);

  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isActive;

    if (wasActive && !isActive) {
      setDrawerOpened(false);
      if (connected) {
        closeMessageStream();
        setConnected(false);
        setSignedIn(false);
        setUsername("");
        setMessages([]);
        toast.warning("Disconnected from server");
      }
    }
  }, [isActive, connected]);

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
              <Button
                onClick={handleClientStart}
                disabled={clientLoading}
                radius={0}
                c="black"
              >
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
            <Group gap="xs">
              {isActive && (
                <Button
                  onClick={() => setDrawerOpened(true)}
                  tt="uppercase"
                  variant="light"
                  radius={0}
                  size="xs"
                  leftSection={<BiServer />}
                >
                  SERVER
                </Button>
              )}
              <Button
                onClick={handleClientStop}
                disabled={clientLoading}
                tt="uppercase"
                color="red.4"
                c="black"
                radius={0}
              >
                STOP_CLIENT
              </Button>
            </Group>
          </Group>
        )}
      </Stack>
      <Chatbox
        messages={
          connected
            ? signedIn
              ? [
                  parseChatMessage(
                    `(SERVER) You're in. Say something, or use the buttons below to see who's online.`,
                  )!,
                  ...messages,
                ]
              : [
                  parseChatMessage(
                    "(SERVER) You're connected. Register and log in to start chatting.",
                  )!,
                  parseChatMessage(
                    "(SERVER) Use the buttons below to register a new account or log in.",
                  )!,
                  parseChatMessage(
                    `(SERVER) Commands marked * require login. To use commands begin them with: ${commandChar}`,
                  )!,
                  ...messages,
                ]
            : [
                parseChatMessage(
                  "(SERVER) Connect to a server to see the chat log here.",
                )!,
              ]
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
                    onClick={() =>
                      handleCommandClick(
                        b.cmd,
                        (b as { download?: boolean }).download,
                      )
                    }
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
                if (signedIn) {
                  setCommand(val);
                } else {
                  if (val && !val.startsWith(commandChar)) {
                    setCommand(commandChar + val);
                  } else {
                    setCommand(val);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendCommand();
              }}
              disabled={!connected}
              styles={{ input: { fontFamily: "JetBrains Mono" } }}
              placeholder={
                connected
                  ? signedIn
                    ? `Type a message or use ${commandChar} for commands...`
                    : "Execute command or send message..."
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
        title={authModalMode}
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
                Send
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title="ADMIN PANEL"
        padding="md"
        position="right"
        styles={{ title: { fontWeight: 900 } }}
      >
        <Stack gap="lg">
          <Stack>
            <HeadingText
              text="server_configuration"
              IconComponent={MdOutlineTerminal}
            />
            <Stack gap={8}>
              <Group justify="space-between">
                <Text c="dimmed" tt="uppercase">
                  max_users
                </Text>
                <Text ff="monospace">{capacity}</Text>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text c="dimmed" tt="uppercase">
                  cmd_char
                </Text>
                <Text ff="monospace">{serverCmdChar}</Text>
              </Group>
            </Stack>
          </Stack>
          <Stack>
            <HeadingText text="connection_info" IconComponent={BiServer} />
            <Stack
              c="cyan.9"
              p={8}
              style={{
                border: "1px solid var(--mantine-color-default-border)",
              }}
              gap={4}
            >
              <Group justify="space-between">
                <Text tt="uppercase" ff="monospace">
                  port: {serverPort}
                </Text>
                <CustomCopyButton value={String(serverPort)} valueName="port" />
              </Group>
              <Group justify="space-between">
                <Text tt="uppercase" ff="monospace">
                  server_ip: {serverIP}
                </Text>
                <CustomCopyButton value={serverIP} valueName="IP" />
              </Group>
            </Stack>
          </Stack>
          <Stack>
            <Group justify="space-between">
              <HeadingText
                text="active_sessions"
                IconComponent={MdOutlinePeopleAlt}
              />
              <Group
                px={4}
                py={2}
                bdrs={4}
                style={{
                  backgroundColor: "var(--mantine-primary-color-light)",
                  color: "var(--mantine-primary-color-filled)",
                }}
              >
                <Text c="primary" size="xs">
                  {activeUsers.length} / {capacity}
                </Text>
              </Group>
            </Group>
            <Stack gap={8}>
              {activeUsers.map((username) => (
                <Group
                  key={username}
                  p={8}
                  gap={8}
                  style={{
                    backgroundColor:
                      "light-dark(var(--mantine-color-gray-2), var(--mantine-color-gray-8))",
                  }}
                >
                  <Badge color="green.4" variant="filled" circle size="0.7em" />
                  <Text tt="uppercase" ff="monospace">
                    {username}
                  </Text>
                </Group>
              ))}
              {inactiveUsers.map((username) => (
                <Group
                  key={username}
                  p={8}
                  gap={8}
                  opacity={0.6}
                  style={{
                    backgroundColor:
                      "light-dark(var(--mantine-color-gray-2), var(--mantine-color-gray-8))",
                  }}
                >
                  <Badge color="dark.2" variant="filled" circle size="0.7em" />
                  <Text tt="uppercase" ff="monospace">
                    {username}
                  </Text>
                </Group>
              ))}
            </Stack>
            <Button
              onClick={handleServerStop}
              disabled={loading}
              tt="uppercase"
              color="red.4"
              c="black"
              radius={0}
              fullWidth
            >
              stop_server
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </Stack>
  );
}
export default Client;
