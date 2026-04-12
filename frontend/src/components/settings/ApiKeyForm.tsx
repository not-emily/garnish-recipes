import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, AlertCircle, Sparkles, Trash2 } from "lucide-react";
import {
  getUserSettings,
  updateUserSettings,
  testLlmConnection,
  type LlmProvider,
} from "@/api/userSettings";
import type { ApiError } from "@/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const PROVIDER_OPTIONS: { value: LlmProvider; label: string; hint: string }[] = [
  {
    value: "anthropic",
    label: "Anthropic",
    hint: "claude-haiku-4-5 (cheap & fast), claude-sonnet-4-6 (higher quality)",
  },
  {
    value: "openai",
    label: "OpenAI",
    hint: "gpt-4o (best all-rounder), gpt-5 (highest quality)",
  },
  {
    value: "ollama",
    label: "Ollama (local)",
    hint: "llava (vision-capable), llama3.1:8b (text only)",
  },
];

export function ApiKeyForm() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["userSettings"],
    queryFn: getUserSettings,
  });

  const settings = data?.data;

  const [provider, setProvider] = useState<LlmProvider>("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Hydrate the form with existing settings on first load.
  useEffect(() => {
    if (!settings) return;
    if (settings.llm_provider) setProvider(settings.llm_provider);
    if (settings.llm_model) setModel(settings.llm_model);
    // Never hydrate the API key — only the boolean has_llm_key is exposed.
    // The user has to retype to change it.
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (input: {
      llm_provider?: LlmProvider | null;
      llm_model?: string | null;
      llm_api_key?: string | null;
    }) => updateUserSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] });
      setApiKey("");
    },
  });

  // The form is "dirty" — and Save is enabled — only when at least one field
  // differs from what's saved server-side. The API key field counts as dirty
  // whenever the user has typed *anything* into it (we never read the saved
  // value back).
  const isDirty =
    provider !== (settings?.llm_provider ?? "anthropic") ||
    model.trim() !== (settings?.llm_model ?? "") ||
    apiKey.length > 0;

  const testMutation = useMutation({
    mutationFn: () =>
      testLlmConnection({
        provider,
        model,
        // If the user typed a new key, test against it. Otherwise the
        // backend will fall back to the saved key.
        api_key: apiKey || undefined,
      }),
    onSuccess: (res) => {
      const r = res.data;
      if (r.ok) {
        setTestResult({
          ok: true,
          message: `${r.provider} (${r.model}) replied: "${r.reply}"`,
        });
      } else {
        setTestResult({ ok: false, message: r.message });
      }
    },
    onError: (err) => {
      const apiErr = err as ApiError;
      setTestResult({
        ok: false,
        message: apiErr.error?.message ?? "Unknown error",
      });
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;

    // Only send fields that actually changed. Crucially, we OMIT llm_api_key
    // when the user didn't type a new one — sending null would clear the
    // saved key, which is not what they want. The clear-credentials path is
    // a separate explicit action (the Remove button).
    const payload: {
      llm_provider?: LlmProvider | null;
      llm_model?: string | null;
      llm_api_key?: string | null;
    } = {
      llm_provider: provider,
      llm_model: model.trim() || null,
    };
    if (apiKey.length > 0) {
      payload.llm_api_key = apiKey;
    }
    saveMutation.mutate(payload);
  }

  function handleClear() {
    setConfirmClear(false);
    saveMutation.mutate({
      llm_provider: null,
      llm_model: null,
      llm_api_key: null,
    });
    setProvider("anthropic");
    setModel("");
    setApiKey("");
    setTestResult(null);
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const selectedProvider = PROVIDER_OPTIONS.find((p) => p.value === provider);
  const hasCredentials = settings?.has_llm_key && settings?.llm_provider && settings?.llm_model;
  const canTest = provider && model.trim() && (apiKey || settings?.has_llm_key);
  const saveError =
    saveMutation.error
      ? (saveMutation.error as ApiError).error?.message
      : null;

  return (
    <form
      onSubmit={handleSave}
      className="space-y-4 rounded-lg border border-gray-200 p-4"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-garnish-600" />
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">Recipe extraction (LLM)</h3>
          <p className="mt-1 text-sm text-gray-600">
            Bring your own LLM API key to auto-parse PDFs and recipe blogs that
            don't ship structured data. Garnish never logs or shares your key.
            Typical cost: under $0.01 per import with Anthropic Haiku.
          </p>
        </div>
      </div>

      {hasCredentials && !apiKey && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <Check className="h-4 w-4" />
          <span>
            Configured: <strong>{settings.llm_provider}</strong> ·{" "}
            <strong>{settings.llm_model}</strong>
          </span>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as LlmProvider);
            setTestResult(null);
          }}
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        >
          {PROVIDER_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="llm-model"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Model
        </label>
        <input
          id="llm-model"
          type="text"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setTestResult(null);
          }}
          placeholder="e.g. claude-haiku-4-5"
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        {selectedProvider && (
          <p className="mt-1.5 text-xs text-gray-500">
            Recommended: {selectedProvider.hint}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="llm-api-key"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          API key
        </label>
        <input
          id="llm-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setTestResult(null);
          }}
          placeholder={settings?.has_llm_key ? "•••••••• (saved)" : "sk-..."}
          autoComplete="off"
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        {settings?.has_llm_key && !apiKey && (
          <p className="mt-1.5 text-xs text-gray-500">
            Leave blank to keep your saved key. Type a new one to replace it.
          </p>
        )}
      </div>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            testResult.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {testResult.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="break-words">{testResult.message}</span>
        </div>
      )}

      {saveError && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => testMutation.mutate()}
          disabled={!canTest || testMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Test connection
        </button>
        <button
          type="submit"
          disabled={saveMutation.isPending || !isDirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        {hasCredentials && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={saveMutation.isPending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Remove LLM credentials?"
        message="Recipe imports will fall back to free extractors only."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </form>
  );
}
