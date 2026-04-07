import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api, setAccessToken, setSessionExpiredHandler } from "@/api/client";
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

    async function restoreSession() {
      try {
        const res = await api<ApiResponse<{ user: User; access_token: string }>>(
          "/auth/refresh",
          { method: "POST" }
        );
        setAccessToken(res.data.access_token);
        setUser(res.data.user);
      } catch {
        // No valid session, that's fine
      } finally {
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
  }, []);

  // Handle session expiration triggered from the API client
  // (e.g., refresh token rejected, multi-tab race, etc.)
  const handleSessionExpired = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

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
