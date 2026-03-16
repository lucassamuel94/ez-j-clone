import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const MODULE_IMPORT_RECOVERY_KEY = "__module_import_recovery_done__";

const shouldRecoverFromImportFailure = (message: string) =>
  message.includes("Importing a module script failed");

const recoverFromImportFailure = () => {
  if (sessionStorage.getItem(MODULE_IMPORT_RECOVERY_KEY) === "1") return;
  sessionStorage.setItem(MODULE_IMPORT_RECOVERY_KEY, "1");

  const reload = () => window.location.reload();

  if (!('serviceWorker' in navigator)) {
    reload();
    return;
  }

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined)
    .then(async () => {
      if (!('caches' in window)) return;
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    })
    .finally(reload);
};

window.addEventListener("error", (event) => {
  const message = event.error instanceof Error ? event.error.message : event.message;
  if (!shouldRecoverFromImportFailure(message)) return;
  recoverFromImportFailure();
});

window.addEventListener("unhandledrejection", (event) => {
  const message =
    event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
  if (!shouldRecoverFromImportFailure(message)) return;
  recoverFromImportFailure();
});

// Register Service Worker with auto-update
if ('serviceWorker' in navigator) {
  let refreshing = false;

  // Reload page when new SW takes control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      // Check for updates every 60 seconds
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
    })
    .catch((err) => {
      console.warn('SW registration failed:', err);
    });
}

createRoot(document.getElementById("root")!).render(<App />);
