import { useState, useEffect, useRef, type ComponentType } from "react";
import {
  Text,
  TextInput,
  Button,
  Group,
  Tooltip,
  Stack,
  NumberInput,
  Divider,
  Indicator,
} from "@mantine/core";
import {
  startServer,
  stopServer,
  getHostIP,
  stopAdminClient,
} from "../api/tcpServer";
import { BASEURL } from "../api/config";
import styles from "./Server.module.css";
import { sendAdminCommand, startAdminClient } from "../api/tcpServer";
import { toast, ToastContainer } from "react-toastify";
import {
  MdHelpOutline,
  MdOutlinePeopleAlt,
  MdOutlineTerminal,
} from "react-icons/md";
import { BiServer } from "react-icons/bi";
import CustomCopyButton from "../components/CustomCopyButton";

function HeadingText({
  text,
  IconComponent,
}: {
  text: string;
  IconComponent: ComponentType<object>;
}) {
  return (
    <Group justify="flex-start" gap={8} className={styles.headingText}>
      <IconComponent />
      <Text size="sm" tt="uppercase" fw={600}>
        {text}
      </Text>
    </Group>
  );
}

function Server() {
  const [port, setPort] = useState(31337);
  const [capacity, setCapacity] = useState(10);
  const [commandChar, setCmdChar] = useState("~");
  const [serverAddress, setServerAddress] = useState("");
  const [isActive, setActive] = useState(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
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
  }, []);

  useEffect(() => {
    if (!isActive) {
      setActiveUsers([]);
      setInactiveUsers([]);
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

    // open SSE connection to /server/output-admin
    const eventSource = new EventSource(`${BASEURL}/server/output-admin`);
    eventSourceRef.current = eventSource;

    // parse incoming data
    eventSource.onmessage = (event) => {
      for (const data of event.data.split("\n")) {
        if (data === "(SERVER) Logged in users:") {
          finalizeCollection(); // flush any prior incomplete collection
          // start collecting active usernames (logged in)
          collectingRef.current = { list: "active", usernames: [] };
        } else if (data === "(SERVER) No users logged in") {
          finalizeCollection();
          setActiveUsers([]);
          activeUsersRef.current = [];
        } else if (data === "(SERVER) Registered users:") {
          finalizeCollection();
          // start collecting registered usernames
          collectingRef.current = { list: "registered", usernames: [] };
        } else if (data === "(SERVER) No users registered") {
          finalizeCollection();
          registeredUsersRef.current = [];
          setInactiveUsers([]);
        } else if (data.startsWith("(SERVER)")) {
          // other admin messages. terminate any collection thats in progress
          finalizeCollection();
        } else if (collectingRef.current.list && data.trim()) {
          if (!data.includes(": ")) {
            // username list don't include : like broadcast messages
            collectingRef.current.usernames.push(data.trim());
          } else {
            finalizeCollection();
          }
        }
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      eventSource.close();
      eventSourceRef.current = null;
    };

    return () => {
      finalizeCollection();
      eventSource.close();
      eventSourceRef.current = null;
      setActiveUsers([]);
      setInactiveUsers([]);
      activeUsersRef.current = [];
      registeredUsersRef.current = [];
      collectingRef.current = { list: null, usernames: [] };
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const fetchUsers = async () => {
      try {
        await sendAdminCommand(`${commandChar}getlist`);
        await sendAdminCommand(`${commandChar}getregistered`);
      } catch (error: unknown) {
        if (error instanceof Error) {
          toast.error(error.message);
        }
        throw error;
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
    try {
      await startServer(port, capacity, commandChar);
      await startAdmin();
      setActive(true);
      toast.success("Server started!");
    } catch (error: unknown) {
      try {
        await stopServer(port, serverAddress);
      } catch {
        /* ignore */
      }
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const closeAdmin = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    try {
      await stopAdminClient();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleServerStop = async () => {
    try {
      await stopServer(port, serverAddress);
      await closeAdmin();
      setActive(false);
      toast.success("Server stopped!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  return (
    <main className={styles.server}>
      {!isActive ? (
        <Stack
          align="stretch"
          p="xs"
          flex={1}
          style={{
            background: "var(--color-tab-bar-background)",
          }}
        >
          <Text size="sm">
            Choose a port, set your capacity limit, and start listening for
            connections. Once the server is running, share the IP and port with
            anyone you want to connect.
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
            <Button onClick={handleServerStart} radius={0} c="black">
              LAUNCH_SERVER
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack
          maw={300}
          p={16}
          h="100%"
          style={{ background: "var(--color-drawer-background)" }}
        >
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
                <Group px={4} py={2} bdrs={4} className={styles.activeCounter}>
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
                      style={{
                        backgroundColor:
                          "light-dark(var(--mantine-color-gray-2), var(--mantine-color-gray-8))",
                      }}
                    >
                      <Indicator
                        ml={20}
                        color="green.4"
                        offset={-16}
                        position="middle-start"
                      >
                        <Text tt="uppercase" ff="monospace">
                          {username}
                        </Text>
                      </Indicator>
                    </Group>
                  );
                })}
                {inactiveUsers.map((username) => {
                  return (
                    <Group
                      key={username}
                      p={8}
                      style={{
                        backgroundColor:
                          "light-dark(var(--mantine-color-gray-2), var(--mantine-color-gray-8))",
                      }}
                    >
                      <Indicator
                        ml={20}
                        disabled
                        offset={-16}
                        position="middle-start"
                      >
                        <Text tt="uppercase" ff="monospace">
                          {username}
                        </Text>
                      </Indicator>
                    </Group>
                  );
                })}
              </Stack>
              <Button
                onClick={handleServerStop}
                tt="uppercase"
                color="red.4"
                c="black"
                radius={0}
              >
                stop_server
              </Button>
            </Stack>
          </Stack>
        </Stack>
      )}
      <ToastContainer />
    </main>
  );
}
export default Server;
