import { useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { regenerateInviteCode } from "@/api/households";
import { useHousehold } from "@/contexts/HouseholdContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function InviteFlow() {
  const { household, setHousehold } = useHousehold();
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  if (!household?.invite_code) return null;

  async function copyCode() {
    await navigator.clipboard.writeText(household!.invite_code!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    setConfirmRegen(false);
    setIsRegenerating(true);
    try {
      const res = await regenerateInviteCode();
      setHousehold({ ...household!, invite_code: res.data.invite_code });
    } catch {
      // ignore
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-700">Invite Code</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-mono tracking-wider text-gray-800">
          {household.invite_code}
        </code>
        <button
          onClick={copyCode}
          className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-garnish-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => setConfirmRegen(true)}
          disabled={isRegenerating}
          className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          title="Generate new code"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Share this code with someone to let them join your household
      </p>

      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate invite code?"
        message="The current code will stop working. Anyone who hasn't used it yet will need the new one."
        confirmLabel="Regenerate"
        variant="default"
        onConfirm={handleRegenerate}
        onCancel={() => setConfirmRegen(false)}
      />
    </div>
  );
}
