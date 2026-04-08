import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { HouseholdSettings } from "@/components/household/HouseholdSettings";
import { MemberList } from "@/components/household/MemberList";
import { InviteFlow } from "@/components/household/InviteFlow";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";

export function Settings() {
  const { user, logout } = useAuth();
  const { household } = useHousehold();

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Account */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Account
        </h2>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="font-medium text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>
      </section>

      {/* Household */}
      {household && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Household — {household.name}
          </h2>

          <div className="space-y-4">
            <InviteFlow />
            <HouseholdSettings />
          </div>
        </section>
      )}

      {/* Members */}
      {household && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Members
          </h2>
          <MemberList />
        </section>
      )}

      {/* Recipe extraction (LLM API keys) */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Recipe import
        </h2>
        <ApiKeyForm />
      </section>

      {/* Sign out */}
      <section>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
