import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { createHousehold, joinHousehold } from "@/api/households";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { Home, UserPlus } from "lucide-react";
import type { ApiError } from "@/types";

export function Onboarding() {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-garnish-600">garnish</h1>
          <p className="mt-1 text-sm text-gray-500">
            Let's get you set up
          </p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-4 text-left transition-colors hover:border-garnish-300 hover:bg-garnish-50"
            >
              <Home className="h-5 w-5 text-garnish-600" />
              <div>
                <p className="font-medium text-gray-900">Create a Household</p>
                <p className="text-sm text-gray-500">Start your recipe box</p>
              </div>
            </button>

            <button
              onClick={() => setMode("join")}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-4 text-left transition-colors hover:border-garnish-300 hover:bg-garnish-50"
            >
              <UserPlus className="h-5 w-5 text-garnish-600" />
              <div>
                <p className="font-medium text-gray-900">Join a Household</p>
                <p className="text-sm text-gray-500">I have an invite code</p>
              </div>
            </button>
          </div>
        )}

        {mode === "create" && (
          <CreateForm onBack={() => setMode("choose")} />
        )}

        {mode === "join" && (
          <JoinForm onBack={() => setMode("choose")} />
        )}
      </div>
    </div>
  );
}

function CreateForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setHousehold } = useHousehold();
  const [name, setName] = useState(`${user?.name.split(" ")[0]}'s Kitchen`);
  const [diners, setDiners] = useState(2);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await createHousehold({ name, default_diners: diners });
      setHousehold(res.data);
      navigate("/recipes");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.error?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Household name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      <div>
        <label htmlFor="diners" className="block text-sm font-medium text-gray-700">
          How many people usually eat together?
        </label>
        <input
          id="diners"
          type="number"
          required
          min={1}
          max={20}
          value={diners}
          onChange={(e) => setDiners(Number(e.target.value))}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Used for leftover calculations. You can change this later.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-garnish-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 focus:outline-none focus:ring-2 focus:ring-garnish-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create Household"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm text-gray-500 hover:text-gray-700"
      >
        Back
      </button>
    </form>
  );
}

function JoinForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { setHousehold } = useHousehold();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await joinHousehold(inviteCode.trim().toUpperCase());
      setHousehold(res.data);
      navigate("/recipes");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.error?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="invite-code" className="block text-sm font-medium text-gray-700">
          Invite code
        </label>
        <input
          id="invite-code"
          type="text"
          required
          placeholder="BASIL-THYME-42"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase shadow-sm placeholder:normal-case focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Ask your household member for the invite code
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-garnish-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 focus:outline-none focus:ring-2 focus:ring-garnish-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isSubmitting ? "Joining..." : "Join Household"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm text-gray-500 hover:text-gray-700"
      >
        Back
      </button>
    </form>
  );
}

export default Onboarding;
