import { createConsumer, type Consumer } from "@rails/actioncable";
import { getAccessToken } from "@/api/client";

// Singleton consumer. ActionCable maintains its own WebSocket connection
// and auto-reconnects. We create it lazily on first use so the token is
// available (AuthContext hydrates after mount).
let consumer: Consumer | null = null;

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
}
