import type { ApiError } from "@/types";

const API_BASE = "/api/v1";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/**
 * Register a callback that fires when the session expires (refresh token invalid).
 * AuthContext registers a logout-and-redirect handler so that any failed refresh
 * — including races between multiple tabs or expired refresh tokens — sends the
 * user cleanly to the login screen instead of leaving the UI in a half-broken state.
 */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      accessToken = null;
      return null;
    }

    const json = await res.json();
    accessToken = json.data.access_token;
    return accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  // Default to JSON, but for FormData uploads let the browser set its own
  // multipart/form-data Content-Type (including the boundary). Setting it
  // ourselves would break the upload.
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // On 401, try refreshing the token once. The refreshPromise singleton
  // ensures multiple concurrent 401s share a single refresh attempt rather
  // than racing each other.
  if (res.status === 401 && accessToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;

    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });
    } else {
      // Refresh failed — session is dead. Trigger the registered handler
      // (typically a logout + redirect to /login) so the user gets a clean
      // recovery instead of a confusing 401 surfacing in some random component.
      if (onSessionExpired) onSessionExpired();
    }
  }

  if (!res.ok) {
    const errorBody: ApiError = await res.json().catch(() => ({
      error: { code: "unknown", message: "An unexpected error occurred" },
    }));
    throw errorBody;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
