import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Link as LinkIcon, Copy, Trash2 } from "lucide-react";
import { shareRecipe, revokeShare } from "@/api/recipes";
import { useToast } from "@/components/ui/Toast";
import { MutationButton } from "@/components/ui/MutationButton";

interface ShareRecipeDialogProps {
  open: boolean;
  onClose: () => void;
  recipeApikey: string;
  // The current share_url from the recipe payload (null if not shared). The
  // dialog reflects this as its initial state; generating or revoking
  // mutates it and keeps the local view in sync.
  currentShareUrl: string | null;
}

export function ShareRecipeDialog({
  open,
  onClose,
  recipeApikey,
  currentShareUrl,
}: ShareRecipeDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState<string | null>(currentShareUrl);

  const generateMutation = useMutation({
    mutationFn: () => shareRecipe(recipeApikey),
    onSuccess: (res) => {
      setShareUrl(res.data.share_url);
      queryClient.invalidateQueries({ queryKey: ["recipe", recipeApikey] });
    },
    onError: () => toast("Couldn't generate a share link. Try again.", "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeShare(recipeApikey),
    onSuccess: () => {
      setShareUrl(null);
      queryClient.invalidateQueries({ queryKey: ["recipe", recipeApikey] });
      toast("Sharing stopped. Old link no longer works.", "success");
    },
    onError: () => toast("Couldn't revoke the link. Try again.", "error"),
  });

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("Link copied to clipboard", "success");
    } catch {
      // Clipboard API may be unavailable (insecure context, unsupported
      // browser). The URL is visible on-screen for manual copy anyway.
      toast("Couldn't copy automatically — select the link to copy", "error");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
      />

      <div className="relative flex w-full max-w-sm flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Share recipe</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {shareUrl ? (
            <>
              <p className="text-sm text-gray-600">
                Anyone with this link can view this recipe and copy it to their
                own household.
              </p>

              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="break-all text-xs text-gray-600">{shareUrl}</p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white hover:bg-garnish-700"
                >
                  <Copy className="h-4 w-4" />
                  Copy link
                </button>
                <MutationButton
                  type="button"
                  pending={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  aria-label="Stop sharing"
                >
                  <Trash2 className="h-4 w-4" />
                  Stop sharing
                </MutationButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Generate a link you can share with anyone. They'll be able to
                view the recipe and — if they have a Garnish account — copy it
                to their own household.
              </p>

              <MutationButton
                type="button"
                pending={generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
                icon={<LinkIcon className="h-4 w-4" />}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white hover:bg-garnish-700"
              >
                Generate share link
              </MutationButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
