import { useSyncExternalStore } from "react";

/**
 * Global connection state — the single source of truth for "is the app
 * connected enough to work?" The api client pushes HTTP events in here;
 * the cable wiring pushes WebSocket events; OfflineBanner + ConnectionIndicator
 * read the derived state.
 *
 * Design: keep this a plain event emitter so the api client and cable module
 * can call into it without React dependencies, and expose a hook via
 * useSyncExternalStore for components.
 */

type Listener = () => void;

interface State {
  online: boolean;
  // Rolling window of transient-error timestamps (ms since epoch). Sustained
  // failures mean the server is unreachable, not a one-off hiccup.
  transientErrors: number[];
  cableStatus: "unknown" | "connected" | "disconnected";
  cableDisconnectedSince: number | null;
}

const TRANSIENT_WINDOW_MS = 15_000;
const TRANSIENT_THRESHOLD = 3;
const CABLE_RECONNECTING_AFTER_MS = 10_000;

let state: State = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  transientErrors: [],
  cableStatus: "unknown",
  cableDisconnectedSince: null,
};

const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

function pruneTransient(now: number) {
  state.transientErrors = state.transientErrors.filter(
    (t) => now - t < TRANSIENT_WINDOW_MS
  );
}

export function reportTransientError() {
  const now = Date.now();
  pruneTransient(now);
  state = { ...state, transientErrors: [...state.transientErrors, now] };
  notify();
}

export function reportNetworkSuccess() {
  if (state.transientErrors.length === 0) return;
  state = { ...state, transientErrors: [] };
  notify();
}

export function setCableStatus(status: "connected" | "disconnected") {
  if (state.cableStatus === status) return;
  if (status === "connected") {
    state = { ...state, cableStatus: "connected", cableDisconnectedSince: null };
  } else {
    state = {
      ...state,
      cableStatus: "disconnected",
      cableDisconnectedSince: state.cableDisconnectedSince ?? Date.now(),
    };
  }
  notify();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    state = { ...state, online: true };
    notify();
  });
  window.addEventListener("offline", () => {
    state = { ...state, online: false };
    notify();
  });
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export interface DerivedConnectionState {
  isOffline: boolean;
  isServerUnreachable: boolean;
  isCableReconnecting: boolean;
}

function derive(s: State, now: number): DerivedConnectionState {
  const recentTransient = s.transientErrors.filter(
    (t) => now - t < TRANSIENT_WINDOW_MS
  );
  return {
    isOffline: !s.online,
    isServerUnreachable: recentTransient.length >= TRANSIENT_THRESHOLD,
    isCableReconnecting:
      s.cableStatus === "disconnected" &&
      s.cableDisconnectedSince !== null &&
      now - s.cableDisconnectedSince > CABLE_RECONNECTING_AFTER_MS,
  };
}

/**
 * Hook: returns the derived connection state. Re-renders when any of the
 * underlying flags change. Also ticks every second so time-gated flags
 * (isServerUnreachable, isCableReconnecting) recompute as the windows age.
 */
export function useConnectionState(): DerivedConnectionState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // The raw state may not change for 10s while we wait on a cable threshold,
  // so also tick once per second.
  const tick = useSyncExternalStore(subscribeTick, getTick, getTick);
  return derive(snapshot, tick);
}

let tickValue = Date.now();
let tickInterval: ReturnType<typeof setInterval> | null = null;
const tickListeners = new Set<Listener>();

function subscribeTick(listener: Listener) {
  tickListeners.add(listener);
  if (tickInterval === null) {
    tickInterval = setInterval(() => {
      tickValue = Date.now();
      for (const l of tickListeners) l();
    }, 1000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}

function getTick() {
  return tickValue;
}
