import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HouseholdProvider, useHousehold } from "@/contexts/HouseholdContext";
import { useSessionLoading } from "@/hooks/useSessionLoading";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { Onboarding } from "@/pages/Onboarding";
import { Recipes } from "@/pages/Recipes";
import { RecipeDetail } from "@/pages/RecipeDetail";
import { RecipeNew } from "@/pages/RecipeNew";
import { RecipeEdit } from "@/pages/RecipeEdit";
import { MealPlan } from "@/pages/MealPlan";
import { GroceryList } from "@/pages/GroceryList";
import { Collections } from "@/pages/Collections";
import { CollectionDetail } from "@/pages/CollectionDetail";
import { Settings } from "@/pages/Settings";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { hasHousehold } = useHousehold();
  const isLoading = useSessionLoading();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasHousehold) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { hasHousehold } = useHousehold();
  const isLoading = useSessionLoading();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (hasHousehold) return <Navigate to="/recipes" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const isLoading = useSessionLoading();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/recipes" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* Onboarding (authenticated, no household) */}
      <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />

      {/* Protected routes (authenticated + has household) */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/new" element={<RecipeNew />} />
        <Route path="/recipes/:apikey" element={<RecipeDetail />} />
        <Route path="/recipes/:apikey/edit" element={<RecipeEdit />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:apikey" element={<CollectionDetail />} />
        <Route path="/meal-plan" element={<MealPlan />} />
        <Route path="/grocery-list" element={<GroceryList />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/recipes" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <HouseholdProvider>
            <AppRoutes />
          </HouseholdProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
