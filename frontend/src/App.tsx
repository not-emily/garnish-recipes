import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isApiError } from "@/api/client";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HouseholdProvider, useHousehold } from "@/contexts/HouseholdContext";
import { useSessionLoading } from "@/hooks/useSessionLoading";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";

// Lazy-loaded pages — each gets its own chunk
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Recipes = lazy(() => import("@/pages/Recipes"));
const RecipeDetail = lazy(() => import("@/pages/RecipeDetail"));
const RecipeNew = lazy(() => import("@/pages/RecipeNew"));
const RecipeEdit = lazy(() => import("@/pages/RecipeEdit"));
const MealPlan = lazy(() => import("@/pages/MealPlan"));
const GroceryList = lazy(() => import("@/pages/GroceryList"));
const Collections = lazy(() => import("@/pages/Collections"));
const CollectionDetail = lazy(() => import("@/pages/CollectionDetail"));
const Search = lazy(() => import("@/pages/Search"));
const Settings = lazy(() => import("@/pages/Settings"));
const SharedRecipe = lazy(() => import("@/pages/SharedRecipe"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      // Auto-retry only transient errors (5xx, network, timeout). Never retry
      // auth/client/offline — auth will redirect, client is a user error,
      // offline is surfaced by the banner.
      retry: (failureCount, error) => {
        if (!isApiError(error)) return false;
        if (!error.retryable) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      // Mutations never auto-retry: the risk of double-writes (duplicate
      // grocery items, duplicate ratings) outweighs the convenience.
      // Call sites surface a manual retry affordance instead.
      retry: false,
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

  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const isLoading = useSessionLoading();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/recipes" replace />;

  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* Shared recipe — public, but does not redirect logged-in users. They
          get an "Add to my recipes" CTA instead. */}
      <Route
        path="/r/shared/:token"
        element={<Suspense fallback={<LoadingScreen />}><SharedRecipe /></Suspense>}
      />

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
        <Route path="/search" element={<Search />} />
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
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>
              <HouseholdProvider>
                <AppRoutes />
              </HouseholdProvider>
            </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
