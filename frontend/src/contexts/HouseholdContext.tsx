import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getCurrentHousehold } from "@/api/households";
import { useAuth } from "@/contexts/AuthContext";
import type { Household } from "@/types";

interface HouseholdState {
  household: Household | null;
  isLoading: boolean;
  hasHousehold: boolean;
  refresh: () => Promise<void>;
  setHousehold: (h: Household) => void;
}

const HouseholdContext = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await getCurrentHousehold();
      setHousehold(res.data);
    } catch {
      setHousehold(null);
    }
  }, []);

  useEffect(() => {
    // Wait for auth to settle before deciding household state.
    // Without this gate, on a hard refresh we'd briefly say
    // "no household" while auth is still restoring, causing a
    // flicker-redirect to /onboarding and then /recipes.
    if (authLoading) return;

    if (isAuthenticated && user?.has_household) {
      setIsLoading(true);
      refresh().finally(() => setIsLoading(false));
    } else {
      setHousehold(null);
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user?.has_household, refresh]);

  return (
    <HouseholdContext.Provider
      value={{
        household,
        isLoading,
        hasHousehold: !!household,
        refresh,
        setHousehold,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx)
    throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
