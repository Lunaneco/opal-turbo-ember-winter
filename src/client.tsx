import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Kagami } from "@/components/kagami";

startTransition(() => {
  void boot();
});

async function boot() {
  if (import.meta.env.VITE_SPA === "true") {
    const root = document.getElementById("root");
    if (!root) throw new Error("root");
    createRoot(root).render(
      <StrictMode>
        <Kagami />
      </StrictMode>,
    );
    return;
  }
  const { StartClient } = await import("@tanstack/react-start/client");
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
}
