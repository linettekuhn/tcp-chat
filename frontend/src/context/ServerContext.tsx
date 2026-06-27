/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { stopServer } from "../api/tcpServer";
import { toast } from "react-toastify";

interface ServerContextValue {
  port: number;
  setPort: (v: number) => void;
  capacity: number;
  setCapacity: (v: number) => void;
  commandChar: string;
  setCmdChar: (v: string) => void;
  serverAddress: string;
  setServerAddress: (v: string) => void;
  isActive: boolean;
  setActive: (v: boolean) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  activeUsers: string[];
  setActiveUsers: (v: string[]) => void;
  inactiveUsers: string[];
  setInactiveUsers: (v: string[]) => void;
  chatMessages: string[];
  setChatMessages: (v: string[] | ((prev: string[]) => string[])) => void;
  handleServerStop: () => Promise<void>;
}

const ServerContext = createContext<ServerContextValue | null>(null);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [port, setPort] = useState(31337);
  const [capacity, setCapacity] = useState(10);
  const [commandChar, setCmdChar] = useState("~");
  const [serverAddress, setServerAddress] = useState("");
  const [isActive, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<string[]>([]);

  const handleServerStop = useCallback(async () => {
    setLoading(true);
    setActive(false);
    await stopServer(port, serverAddress).catch(() => {});
    toast.info("Server stopped!");
    setLoading(false);
  }, [port, serverAddress]);

  return (
    <ServerContext.Provider
      value={{
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
        setActiveUsers,
        inactiveUsers,
        setInactiveUsers,
        chatMessages,
        setChatMessages,
        handleServerStop,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServerContext() {
  const ctx = useContext(ServerContext);
  if (!ctx)
    throw new Error("useServerContext must be used within ServerProvider");
  return ctx;
}
