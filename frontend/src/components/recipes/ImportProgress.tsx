import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { getImport } from "@/api/imports";
import type { ImportStatus } from "@/types/recipe";

interface ImportProgressProps {
  apikey: string;
  // The current status from the parent's recipe query — used to decide whether
  // to keep polling. When this flips out of "importing", parent will re-render
  // into the regular recipe view and we unmount.
  status: ImportStatus | null | undefined;
  sourceUrl?: string | null;
  errorMessage?: string | null;
}

const POLL_INTERVAL_MS = 1500;

export function ImportProgress({
  apikey,
  status,
  sourceUrl,
  errorMessage,
}: ImportProgressProps) {
  const queryClient = useQueryClient();

  // Poll the import endpoint while the job is in flight. When it finishes,
  // invalidate the parent recipe query so RecipeDetail re-fetches the now-
  // populated recipe data.
  const { data } = useQuery({
    queryKey: ["import", apikey],
    queryFn: () => getImport(apikey),
    enabled: status === "importing",
    refetchInterval: (query) => {
      const current = query.state.data?.data?.import_status;
      return current === "importing" ? POLL_INTERVAL_MS : false;
    },
  });

  // When the polled status leaves "importing", refresh the recipe so the
  // parent component swaps to the normal recipe view.
  useEffect(() => {
    const polled = data?.data?.import_status;
    if (polled && polled !== "importing") {
      queryClient.invalidateQueries({ queryKey: ["recipe", apikey] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    }
  }, [data, apikey, queryClient]);

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <h3 className="font-medium text-red-900">Import failed</h3>
            <p className="mt-1 text-sm text-red-700">
              {errorMessage || "We couldn't process this URL."}
            </p>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-red-700 underline hover:text-red-900"
              >
                <ExternalLink className="h-3 w-3" />
                Open original
              </a>
            )}
            <div className="mt-3">
              <Link
                to="/recipes"
                className="text-sm font-medium text-red-700 hover:text-red-900"
              >
                ← Back to recipes
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // status === "importing" — show the spinner card
  return (
    <div className="rounded-xl border border-garnish-200 bg-garnish-50 p-6 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-garnish-600" />
      <h3 className="mt-3 font-medium text-garnish-900">Importing recipe…</h3>
      <p className="mt-1 text-sm text-garnish-700">
        Fetching the page and extracting the recipe.
      </p>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-garnish-700 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {sourceUrl}
        </a>
      )}
    </div>
  );
}
