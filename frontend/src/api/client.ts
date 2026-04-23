import type { ApiErrorBody } from "@/types";
import { reportNetworkSuccess, reportTransientError } from "@/lib/connectionState";

const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1`;

let accessToken: string | null = null;
let refreshPromise: Promise<RefreshOutcome> | null = null;
let onSessionExpired: (() => void) | null = null;

type RefreshOutcome =
  | { kind: "success"; token: string }
  | { kind: "transient" }  // server hiccup — keep session, don't retry
  | { kind: "expired" };   // refresh token is actually gone — session is dead

export type ApiErrorCategory = "auth" | "client" | "transient" | "offline";

/**
 * Classified error thrown by the api() client.
 *
 * - `auth`: 401 after a failed refresh attempt. Session is gone; clear it.
 * - `client`: 4xx other than 401. User/input error; surface inline.
 * - `transient`: 5xx, network failure, or timeout. Session is fine — retry or
 *   show the offline banner. Never clear auth on these.
 * - `offline`: navigator.onLine is false at request time.
 *
 * The old response-body shape is preserved on `.body` for call sites that
 * still need the full `{ error: { code, message, details } }` payload.
 */
export class ApiError extends Error {
  readonly category: ApiErrorCategory;
  readonly status: number | null;
  readonly code: string;
  readonly details?: Record<string, string[]>;
  readonly retryable: boolean;
  readonly body: ApiErrorBody | null;

  constructor(opts: {
    category: ApiErrorCategory;
    status: number | null;
    message: string;
    code?: string;
    details?: Record<string, string[]>;
    retryable: boolean;
    body?: ApiErrorBody | null;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.category = opts.category;
    this.status = opts.status;
    this.code = opts.code ?? "unknown";
    this.details = opts.details;
    this.retryable = opts.retryable;
    this.body = opts.body ?? null;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function classifyHttpError(res: Response, body: ApiErrorBody | null): ApiError {
  const message =
    body?.error?.message ??
    (res.status === 401
      ? "Not authorized"
      : res.status >= 500
        ? "Server error — please try again"
        : "Request failed");

  if (res.status === 401) {
    return new ApiError({
      category: "auth",
      status: 401,
      message,
      code: body?.error?.code,
      details: body?.error?.details,
      retryable: false,
      body,
    });
  }
  if (res.status >= 500 || res.status === 408 || res.status === 504) {
    return new ApiError({
      category: "transient",
      status: res.status,
      message,
      code: body?.error?.code,
      details: body?.error?.details,
      retryable: true,
      body,
    });
  }
  return new ApiError({
    category: "client",
    status: res.status,
    message,
    code: body?.error?.code,
    details: body?.error?.details,
    retryable: false,
    body,
  });
}

function classifyNetworkError(err: unknown): ApiError {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new ApiError({
      category: "offline",
      status: null,
      message: "You're offline",
      retryable: true,
      body: null,
    });
  }
  return new ApiError({
    category: "transient",
    status: null,
    message: "Can't reach the server — please try again",
    retryable: true,
    body: null,
    details: err instanceof Error ? undefined : undefined,
  });
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/**
 * Register a callback that fires only when the session has *definitely* ended
 * (a 401 that a refresh attempt could not recover). Transient errors do not
 * trigger this — they surface as ApiError { category: "transient" } and the
 * caller / query layer decides how to respond.
 */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

async function refreshAccessToken(): Promise<RefreshOutcome> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      // A 5xx on refresh is transient (server hiccup). Leave the token alone —
      // the caller will see a "transient" outcome and bail out without retrying
      // the original request or touching auth state.
      if (res.status >= 500) return { kind: "transient" };
      accessToken = null;
      return { kind: "expired" };
    }

    const json = await res.json();
    accessToken = json.data.access_token;
    return { kind: "success", token: accessToken as string };
  } catch {
    // Network failure — not an auth failure.
    return { kind: "transient" };
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (err) {
    reportTransientError();
    throw classifyNetworkError(err);
  }

  // On 401, try refreshing once. The refreshPromise singleton ensures multiple
  // concurrent 401s share a single refresh attempt rather than racing.
  if (res.status === 401 && accessToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const outcome = await refreshPromise;

    if (outcome.kind === "success") {
      headers["Authorization"] = `Bearer ${outcome.token}`;
      try {
        res = await fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
      } catch (err) {
        reportTransientError();
        throw classifyNetworkError(err);
      }
    } else if (outcome.kind === "transient") {
      // Server hiccup during refresh. Don't retry the original request with a
      // possibly-stale token (that retry could trip the false-logout path if
      // it happened to 401). Bail with a transient error so the query layer
      // retries cleanly once the server recovers.
      reportTransientError();
      throw new ApiError({
        category: "transient",
        status: null,
        message: "Can't reach the server — please try again",
        retryable: true,
        body: null,
      });
    } else {
      // Refresh explicitly failed (4xx) — the session really is dead.
      if (onSessionExpired) onSessionExpired();
    }
  }

  if (!res.ok) {
    const body: ApiErrorBody | null = await res.json().catch(() => null);
    const err = classifyHttpError(res, body);
    if (err.category === "transient") reportTransientError();
    throw err;
  }

  reportNetworkSuccess();
  if (res.status === 204) return undefined as T;
  return res.json();
}
