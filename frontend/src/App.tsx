import {
  Tabs,
  Group,
  Text,
  ActionIcon,
  useMantineColorScheme,
  Tooltip,
} from "@mantine/core";
import { IoSunny, IoMoon } from "react-icons/io5";
import Server from "./pages/Server";
import Client from "./pages/Client";
import { ImTerminal } from "react-icons/im";
import { LuLogIn, LuRadio } from "react-icons/lu";
import styles from "./App.module.css";

function App() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          background: "var(--color-top-bar-background)",
        }}
      >
        <Group gap={4} c={colorScheme === "dark" ? "cyan.2" : "teal.8"}>
          <ImTerminal />
          <Text fw={700} size="lg">
            TCP_CHAT
          </Text>
        </Group>
        <Tooltip label={colorScheme === "dark" ? "Light mode" : "Dark mode"}>
          <ActionIcon variant="outline" onClick={toggleColorScheme} size="lg">
            {colorScheme === "dark" ? (
              <IoSunny size={20} />
            ) : (
              <IoMoon size={20} />
            )}
          </ActionIcon>
        </Tooltip>
      </Group>
      <Tabs
        defaultValue="start_server"
        keepMountedMode="display-none"
        classNames={{ tab: styles.tab }}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <Tabs.List
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
            background: "var(--color-tab-bar-background)",
          }}
        >
          <Tabs.Tab
            value="start_server"
            style={{ borderRadius: 0 }}
            leftSection={<LuRadio size="1.2em" />}
          >
            <Text size="sm" tt="uppercase" fw={600}>
              start_server
            </Text>
          </Tabs.Tab>

          <Tabs.Tab
            value="join_server"
            style={{ borderRadius: 0 }}
            leftSection={<LuLogIn size="1.2em" />}
          >
            <Text size="sm" tt="uppercase" fw={600}>
              join_server
            </Text>
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel
          value="start_server"
          style={{
            flex: 1,
            overflow: "hidden",
            background: "var(--color-background)",
          }}
        >
          <Server />
        </Tabs.Panel>
        <Tabs.Panel
          value="join_server"
          style={{
            flex: 1,
            overflow: "hidden",
            background: "var(--color-background)",
          }}
        >
          <Client />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

export default App;
