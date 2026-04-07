import { useAuth } from "@/contexts/AuthContext";

export function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Signed in as</p>
          <p className="mt-1 font-medium text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>

        <button
          onClick={logout}
          className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
