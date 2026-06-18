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
import HelpIcon from "./components/HelpIcon";
import { ImTerminal } from "react-icons/im";

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
        }}
      >
        <Group gap={4}>
          <ImTerminal />
          <Text fw={700} size="lg">
            TCP_CHAT
          </Text>
        </Group>
        <Tooltip label={colorScheme === "dark" ? "Light mode" : "Dark mode"}>
          <ActionIcon variant="default" onClick={toggleColorScheme} size="lg">
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
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="start_server">start_server</Tabs.Tab>
          <Tabs.Tab value="join_server">join_server</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel
          value="start_server"
          style={{ flex: 1, overflowY: "auto" }}
        >
          <Server />
        </Tabs.Panel>
        <Tabs.Panel
          value="join_server"
          style={{ flex: 1, overflowY: "auto" }}
        >
          <Client />
        </Tabs.Panel>
      </Tabs>
      <HelpIcon />
    </div>
  );
}

export default App;
