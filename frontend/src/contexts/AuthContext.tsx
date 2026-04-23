import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAccessToken, setSessionExpiredHandler, isApiError } from "@/api/client";
import { resetConsumer } from "@/lib/cable";
import type { User, ApiResponse } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const restoreStarted = useRef(false);

  // Try to restore session on mount via refresh token.
  // Guarded with a ref so React StrictMode's double-mount in dev
  // doesn't fire two parallel /auth/refresh calls (which would race
  // and invalidate each other's rotated refresh tokens).
  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;

    async function restoreSession(attempt = 0) {
      try {
        const res = await api<ApiResponse<{ user: User; access_token: string }>>(
          "/auth/refresh",
          { method: "POST" }
        );
        setAccessToken(res.data.access_token);
        setUser(res.data.user);
        setIsLoading(false);
      } catch (err) {
        // Only a real auth/client failure means "no valid session" — treating
        // a transient server hiccup that way was the "random logout" bug.
        // For transient/offline errors, retry a few times before giving up;
        // once we stop retrying, leave the user unauthenticated so the login
        // screen renders (they can sign in manually when the server recovers).
        if (isApiError(err) && err.category === "transient" && attempt < 3) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          setTimeout(() => restoreSession(attempt + 1), delay);
          return;
        }
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<ApiResponse<{ user: User; access_token: string }>>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ user: { email, password } }),
      }
    );
    setAccessToken(res.data.access_token);
    setUser(res.data.user);
  }, []);

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      passwordConfirmation: string
    ) => {
      const res = await api<ApiResponse<{ user: User; access_token: string }>>(
        "/auth/signup",
        {
          method: "POST",
          body: JSON.stringify({
            user: {
              name,
              email,
              password,
              password_confirmation: passwordConfirmation,
            },
          }),
        }
      );
      setAccessToken(res.data.access_token);
      setUser(res.data.user);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "DELETE" });
    } catch {
      // Logout even if the server call fails
    }
    setAccessToken(null);
    setUser(null);
    resetConsumer();
    queryClient.clear();
  }, [queryClient]);

  // Handle session expiration triggered from the API client
  // (e.g., refresh token rejected, multi-tab race, etc.)
  const handleSessionExpired = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    resetConsumer();
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
    return () => setSessionExpiredHandler(null);
  }, [handleSessionExpired]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
