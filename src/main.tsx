import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import App from "./App";
import { persister, queryClient } from "./lib/queryClient";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // 24h — past this, the persisted blob is dropped on hydrate.
        maxAge: 1000 * 60 * 60 * 24,
        // Bump when query key shapes change to invalidate old caches.
        buster: "v1",
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
);
