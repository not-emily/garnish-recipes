import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";

/**
 * Returns the combined loading state of the auth and household contexts.
 * All route guards should use this single source of truth so they can never
 * fall out of sync (which previously caused flicker-redirects on hard refresh).
 */
export function useSessionLoading() {
  const { isLoading: authLoading } = useAuth();
  const { isLoading: householdLoading } = useHousehold();
  return authLoading || householdLoading;
}
