import { useEffect, useRef, type ReactNode } from "react";
import type { ChatMessage } from "../types";
import styles from "./Chatbox.module.css";
import { Stack, Box, Text, ScrollArea, Badge, Group } from "@mantine/core";

type Props = {
  messages: ChatMessage[];
  children?: ReactNode;
};

export default function Chatbox({ messages, children }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Stack h="100%" w="100%" gap={0} style={{ minHeight: 0, flex: 1 }}>
      <ScrollArea flex={1} p={16} style={{ minHeight: 0 }}>
        <Stack gap={4}>
          {messages.map((msg) => (
            <Text
              key={msg.id}
              component="div"
              fs={msg.isSystem ? "italic" : ""}
              c={msg.isSystem ? "dimmed" : ""}
              ff="monospace"
            >
              <Group align="flex-start" c={msg.isSystem ? "dimmed" : ""}>
                <Text component="span" className={styles.timestamp}>
                  {msg.timestamp}
                </Text>{" "}
                <Stack gap={2}>
                  <Badge
                    className={msg.isSystem ? styles.systemBadge : ""}
                    variant={msg.isSystem ? "transparent" : "default"}
                    radius={4}
                    c={msg.isSystem ? "dimmed" : ""}
                  >
                    {msg.isSystem ? "System" : msg.sender}
                  </Badge>{" "}
                  <Text component="span" className={styles.text}>
                    {msg.text}
                  </Text>
                </Stack>
              </Group>
            </Text>
          ))}
          <Box ref={endRef} />
        </Stack>
      </ScrollArea>
      <Box style={{ flexShrink: 0 }}>{children}</Box>
    </Stack>
  );
}
