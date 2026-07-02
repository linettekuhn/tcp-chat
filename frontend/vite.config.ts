import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/server": "http://localhost:3003",
      "/client": "http://localhost:3003",
    },
  },
});
