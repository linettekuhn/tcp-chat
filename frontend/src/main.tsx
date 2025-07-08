import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Client from "./pages/Client.tsx";
import Server from "./pages/Server.tsx";

const router = createBrowserRouter(
  [
    { path: "/", element: <App /> },
    { path: "/server", element: <Server /> },
    { path: "/client", element: <Client /> },
  ],
  { basename: import.meta.env.BASE_URL }
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
