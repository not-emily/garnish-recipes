import type { ApiError } from "@/types";

const API_BASE = "/api/v1";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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

  // On 401, try refreshing the token once
  if (res.status === 401 && accessToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken();
    }
    const newToken = await refreshPromise;
    refreshPromise = null;

    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });
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
