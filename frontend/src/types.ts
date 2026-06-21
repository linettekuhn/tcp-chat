export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  isSystem: boolean;
  sender?: string;
}

let idCounter = 0;

export function formatTimestamp(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const USER_LIST_HEADERS = new Set([
  "(SERVER) Logged in users:",
  "(SERVER) Registered users:",
  "(SERVER) No users logged in",
  "(SERVER) No users registered",
]);

export function parseChatMessage(raw: string): ChatMessage | null {
  if (USER_LIST_HEADERS.has(raw)) return null;
  if (!raw.startsWith("(SERVER)") && !raw.includes(": ")) return null;

  const timestamp = formatTimestamp(new Date());
  const id = `${Date.now()}-${++idCounter}`;

  if (raw.startsWith("(SERVER)")) {
    return { id, text: raw.replace("(SERVER) ", ""), timestamp, isSystem: true };
  }

  const idx = raw.indexOf(": ");
  return {
    id,
    text: raw.slice(idx + 2),
    timestamp,
    isSystem: false,
    sender: raw.slice(0, idx),
  };
}
