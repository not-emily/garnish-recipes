import { createConsumer, type Consumer } from "@rails/actioncable";
import { getAccessToken } from "@/api/client";
import { setCableStatus } from "@/lib/connectionState";

// Singleton consumer. ActionCable maintains its own WebSocket connection
// and auto-reconnects. We create it lazily on first use so the token is
// available (AuthContext hydrates after mount).
let consumer: Consumer | null = null;
let statusPoll: ReturnType<typeof setInterval> | null = null;
let lastReportedOpen: boolean | null = null;

// ActionCable's Consumer doesn't expose connect/disconnect events publicly,
// so poll isOpen() once a second and report changes. Cheap and reliable.
function startStatusPolling(c: Consumer) {
  if (statusPoll !== null) return;
  statusPoll = setInterval(() => {
    const isOpen = c.connection.isOpen();
    if (isOpen === lastReportedOpen) return;
    lastReportedOpen = isOpen;
    setCableStatus(isOpen ? "connected" : "disconnected");
  }, 1000);
}

function stopStatusPolling() {
  if (statusPoll !== null) {
    clearInterval(statusPoll);
    statusPoll = null;
  }
  lastReportedOpen = null;
}

export function getConsumer(): Consumer {
  if (!consumer) {
    const token = getAccessToken();
    // Pass JWT as query param — ActionCable doesn't support custom
    // headers on the WebSocket handshake.
    const wsBase = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^http/, "ws")
      : "";
    const url = token
      ? `${wsBase}/cable?token=${encodeURIComponent(token)}`
      : `${wsBase}/cable`;
    consumer = createConsumer(url);
    startStatusPolling(consumer);
  }
  return consumer;
}

// Called on logout so the next login creates a fresh connection with
// the new token.
export function resetConsumer() {
  if (consumer) {
    consumer.disconnect();
    consumer = null;
  }
  stopStatusPolling();
}
