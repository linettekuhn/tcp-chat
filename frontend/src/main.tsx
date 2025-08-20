import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Client from "./pages/Client.tsx";
import Server from "./pages/Server.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/server" element={<Server />} />
        <Route path="/client" element={<Client />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);
