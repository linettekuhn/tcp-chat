import { useEffect, useRef, type ReactNode } from "react";
import { parseChatMessage } from "../types";
import styles from "./Chatbox.module.css";
import { Stack, Box, Text, ScrollArea, Badge, Group } from "@mantine/core";

type Props = {
  messages: string[];
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
          {messages.map((raw) => {
            const parsed = parseChatMessage(raw);
            if (!parsed) return null;
            return (
              <Text
                key={parsed.id}
                component="div"
                fs={parsed.isSystem ? "italic" : ""}
                c={parsed.isSystem ? "dimmed" : ""}
                ff="monospace"
              >
                <Group align="flex-start" c={parsed.isSystem ? "dimmed" : ""}>
                  <Text component="span" className={styles.timestamp}>
                    {parsed.timestamp}
                  </Text>{" "}
                  <Stack gap={2}>
                    <Badge
                      className={parsed.isSystem ? styles.systemBadge : ""}
                      variant={parsed.isSystem ? "transparent" : "default"}
                      radius={4}
                      c={parsed.isSystem ? "dimmed" : ""}
                    >
                      {parsed.isSystem ? "System" : parsed.sender}
                    </Badge>{" "}
                    <Text component="span" className={styles.text}>
                      {parsed.text}
                    </Text>
                  </Stack>
                </Group>
              </Text>
            );
          })}
          <Box ref={endRef} />
        </Stack>
      </ScrollArea>
      <Box style={{ flexShrink: 0 }}>{children}</Box>
    </Stack>
  );
}
