import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

const app = (
  <StrictMode>
    <StartClient />
  </StrictMode>
);

startTransition(() => {
  if (import.meta.env.VITE_SPA === "true") {
    const root = document.getElementById("root");
    if (!root) throw new Error("root");
    createRoot(root).render(app);
    return;
  }
  hydrateRoot(document, app);
});
