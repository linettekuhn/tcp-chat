import { useEffect, useRef, type ReactNode } from "react";
import { parseChatMessage } from "../types";
import styles from "./Chatbox.module.css";
import { Stack, Box, Text, ScrollArea } from "@mantine/core";

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
                component="p"
                fs={parsed.isSystem ? "italic" : ""}
                c={parsed.isSystem ? "dimmed" : ""}
                ff="monospace"
              >
                <Text component="span" className={styles.timestamp}>
                  {parsed.timestamp}
                </Text>{" "}
                <Text component="span" className={styles.sender}>
                  {parsed.isSystem ? "System" : parsed.sender}:
                </Text>{" "}
                <Text component="span" className={styles.text}>
                  {parsed.text}
                </Text>
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
