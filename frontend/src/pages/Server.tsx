import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Text,
  TextInput,
  Button,
  Group,
  Tooltip,
  Stack,
  NumberInput,
  Divider,
  Badge,
  Drawer,
} from "@mantine/core";
import { startServer, getHostIP } from "../api/tcpServer";
import { BASEURL } from "../api/config";
import { sendAdminCommand, startAdminClient } from "../api/tcpServer";
import Chatbox from "../components/Chatbox";
import { parseChatMessage } from "../types";
import { toast } from "react-toastify";
import {
  MdHelpOutline,
  MdOutlinePeopleAlt,
  MdOutlineTerminal,
} from "react-icons/md";
import { BiServer } from "react-icons/bi";
import CustomCopyButton from "../components/CustomCopyButton";
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

function Server() {
  const {
    port,
    setPort,
    capacity,
    setCapacity,
    commandChar,
    setCmdChar,
    serverAddress,
    setServerAddress,
    isActive,
    setActive,
    loading,
    setLoading,
    activeUsers,
    inactiveUsers,
    chatMessages,
    setChatMessages,
    setActiveUsers,
    setInactiveUsers,
    handleServerStop,
  } = useServerContext();

  const [drawerOpened, setDrawerOpened] = useState(false);

  const collectingRef = useRef<{
    list: "active" | "registered" | null;
    usernames: string[];
  }>({ list: null, usernames: [] });
  const activeUsersRef = useRef<string[]>([]);
  const registeredUsersRef = useRef<string[]>([]);

  useEffect(() => {
    const fetchIP = async () => {
      try {
        const ip = await getHostIP();
        setServerAddress(ip);
      } catch (error: unknown) {
        if (error instanceof Error) {
          toast.error(error.message);
        }
        setServerAddress("127.0.0.1");
      }
    };

    fetchIP();
  }, [setServerAddress]);

  useEffect(() => {
    if (!isActive) {
      setActiveUsers([]);
      setInactiveUsers([]);
      setChatMessages([]);
      activeUsersRef.current = [];
      registeredUsersRef.current = [];
      return;
    }

    // updates states from collected users
    const finalizeCollection = () => {
      const { list, usernames } = collectingRef.current;
      if (list === "active") {
        setActiveUsers(usernames);
        activeUsersRef.current = usernames;
      } else if (list === "registered") {
        registeredUsersRef.current = usernames;
        const inactive = usernames.filter(
          (u) => !activeUsersRef.current.includes(u),
        );
        setInactiveUsers(inactive);
      }
      collectingRef.current = { list: null, usernames: [] };
    };

    const abortController = new AbortController();

    const connect = async () => {
      try {
        const response = await fetch(`${BASEURL}/server/output-admin`, {
          signal: abortController.signal,
          headers: { Accept: "text/event-stream" },
        });

        if (!response.ok) {
          throw new Error(`SSE error: ${response.status}`);
        }
        if (!response.body) {
          throw new Error("SSE response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const dataLines: string[] = [];
            for (const line of part.split("\n")) {
              if (line.startsWith("data: ")) {
                dataLines.push(line.slice(6));
              }
            }
            const eventData = dataLines.join("\n");

            for (const data of eventData.split("\n")) {
              const parsed = parseChatMessage(data);
              if (parsed) setChatMessages((prev) => [...prev, parsed]);
              if (data === "(SERVER) Logged in users:") {
                finalizeCollection();
                collectingRef.current = { list: "active", usernames: [] };
              } else if (data === "(SERVER) No users logged in") {
                finalizeCollection();
                setActiveUsers([]);
                activeUsersRef.current = [];
              } else if (data === "(SERVER) Registered users:") {
                finalizeCollection();
                collectingRef.current = { list: "registered", usernames: [] };
              } else if (data === "(SERVER) No users registered") {
                finalizeCollection();
                registeredUsersRef.current = [];
                setInactiveUsers([]);
              } else if (data.startsWith("(SERVER)")) {
                finalizeCollection();
              } else if (collectingRef.current.list && data.trim()) {
                if (!data.includes(": ")) {
                  collectingRef.current.usernames.push(data.trim());
                } else {
                  finalizeCollection();
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("SSE error:", err);
        }
      }
    };

    connect();

    return () => {
      finalizeCollection();
      abortController.abort();
      setActiveUsers([]);
      setInactiveUsers([]);
      setChatMessages([]);
      activeUsersRef.current = [];
      registeredUsersRef.current = [];
      collectingRef.current = { list: null, usernames: [] };
    };
  }, [isActive, setActiveUsers, setChatMessages, setInactiveUsers]);

  useEffect(() => {
    if (!isActive) return;

    const fetchUsers = async () => {
      try {
        await sendAdminCommand(`${commandChar}getlist`);
        await sendAdminCommand(`${commandChar}getregistered`);
      } catch {
        // silently ignore transient errors during stop/restart
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);

    return () => clearInterval(interval);
  }, [isActive, commandChar]);

  const startAdmin = async () => {
    try {
      await startAdminClient(port, serverAddress);
      await sendAdminCommand(`${commandChar}register admin 123`);
      await sendAdminCommand(`${commandChar}login admin 123`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
      throw error;
    }
  };

  const handleServerStart = async () => {
    setLoading(true);
    try {
      await startServer(port, capacity, commandChar);
      await startAdmin();
      setActive(true);
      toast.success("Server started!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const adminPanelContent = (
    <>
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
            <Text ff="monospace">{commandChar}</Text>
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
              port: {port}
            </Text>
            <CustomCopyButton value={String(port)} valueName="port" />
          </Group>
          <Group justify="space-between">
            <Text tt="uppercase" ff="monospace">
              server_ip: {serverAddress}
            </Text>
            <CustomCopyButton value={serverAddress} valueName="IP" />
          </Group>
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
            {activeUsers.map((username) => {
              return (
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
              );
            })}
            {inactiveUsers.map((username) => {
              return (
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
              );
            })}
          </Stack>
          <Button
            onClick={handleServerStop}
            disabled={loading}
            tt="uppercase"
            color="red.4"
            c="black"
            radius={0}
          >
            stop_server
          </Button>
        </Stack>
      </Stack>
    </>
  );

  return (
    <Stack h="100%" gap={0} style={{ overflow: "hidden" }}>
      {!isActive ? (
        <Stack flex={1} gap={0} h="100%" w="100%" align="flex-start">
          <Stack
            p="xs"
            w="100%"
            style={{
              background: "var(--color-tab-bar-background)",
              alignSelf: "flex-start",
            }}
          >
            <Text size="sm">
              Choose a port, set your capacity limit, and start listening for
              connections. Once the server is running, share the IP and port
              with anyone you want to connect.
            </Text>
            <Group align="flex-end" gap="xl">
              <Stack gap="xs" style={{ flexShrink: 0 }}>
                <Tooltip label="The port your server listens on for incoming connections. Use a number between 1024–65535 that isn't already in use.">
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
                  rightSectionWidth={36}
                  value={port}
                  min={1024}
                  max={65535}
                  clampBehavior="strict"
                  onChange={(value) => setPort(Number(value) || 0)}
                  radius={0}
                  hideControls
                  rightSection={
                    <CustomCopyButton value={String(port)} valueName="port" />
                  }
                />
              </Stack>
              <Stack gap="xs" style={{ flexShrink: 0 }}>
                <Tooltip label="The IP address clients will use to connect to your server. Share this along with the port.">
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
                  rightSectionWidth={36}
                  radius={0}
                  value={serverAddress}
                  onChange={(e) => setServerAddress(e.target.value)}
                  rightSection={
                    <CustomCopyButton value={serverAddress} valueName="IP" />
                  }
                />
              </Stack>
              <Stack gap="xs" style={{ flexShrink: 0 }}>
                <Tooltip label="The maximum number of accounts that can be registered on this server. Once reached, new registrations will be ignored.">
                  <Group
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                      gap: 4,
                      flexWrap: "nowrap",
                    }}
                  >
                    <Text fw={600} size="xs">
                      CAPACITY
                    </Text>
                    <MdHelpOutline />
                  </Group>
                </Tooltip>
                <NumberInput
                  rightSectionWidth={36}
                  value={capacity}
                  min={1}
                  clampBehavior="strict"
                  onChange={(value) => setCapacity(Number(value) || 0)}
                  radius={0}
                  w={150}
                />
              </Stack>
              <Stack gap="xs" style={{ flexShrink: 0 }}>
                <Tooltip label="The character that begins every command, like ~help or ~login.">
                  <Group
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                      gap: 4,
                      flexWrap: "nowrap",
                    }}
                  >
                    <Text fw={600} size="xs">
                      CMD_CHAR
                    </Text>
                    <MdHelpOutline />
                  </Group>
                </Tooltip>
                <TextInput
                  rightSectionWidth={36}
                  radius={0}
                  w={150}
                  maxLength={1}
                  value={commandChar}
                  onChange={(e) => setCmdChar(e.target.value)}
                />
              </Stack>
              <Button
                onClick={handleServerStart}
                disabled={loading}
                radius={0}
                c="black"
              >
                LAUNCH_SERVER
              </Button>
            </Group>
          </Stack>
          <Chatbox
            messages={[parseChatMessage("(SERVER) Launch your server to see the chat log here.")!]}
          />
        </Stack>
      ) : (
        <Stack h="100%" gap={0} style={{ overflow: "hidden" }}>
          <Group
            hiddenFrom="sm"
            justify="flex-end"
            p="sm"
            style={{ flexShrink: 0 }}
          >
            <Button
              onClick={() => setDrawerOpened(true)}
              tt="uppercase"
              variant="light"
              radius={0}
              size="xs"
              leftSection={<BiServer />}
            >
              admin
            </Button>
            <Button
              onClick={handleServerStop}
              disabled={loading}
              tt="uppercase"
              color="red.4"
              c="black"
              radius={0}
              size="xs"
            >
              stop_server
            </Button>
          </Group>
          <Group
            h="100%"
            w="100%"
            align="flex-start"
            style={{ flex: 1, overflow: "hidden" }}
          >
            <Chatbox messages={chatMessages} />
            <Stack
              visibleFrom="sm"
              maw={300}
              p={16}
              h="100%"
              style={{ background: "var(--color-drawer-background)" }}
            >
              {adminPanelContent}
            </Stack>
          </Group>
          <Drawer
            hiddenFrom="sm"
            opened={drawerOpened}
            onClose={() => setDrawerOpened(false)}
            title="ADMIN PANEL"
            padding="md"
            position="right"
            styles={{ title: { fontWeight: 900 } }}
          >
            <Stack gap="lg">{adminPanelContent}</Stack>
          </Drawer>
        </Stack>
      )}
    </Stack>
  );
}
export default Server;
