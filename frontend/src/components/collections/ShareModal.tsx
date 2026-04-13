import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Trash2, Loader2, Send } from "lucide-react";
import { listShares, shareCollection, revokeShare } from "@/api/collections";
import type { ApiError } from "@/types";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  collectionApikey: string;
  collectionName: string;
}

export function ShareModal({
  open,
  onClose,
  collectionApikey,
  collectionName,
}: ShareModalProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["collectionShares", collectionApikey],
    queryFn: () => listShares(collectionApikey),
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: (targetEmail: string) => shareCollection(collectionApikey, targetEmail),
    onSuccess: () => {
      setEmail("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["collectionShares", collectionApikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setError(apiErr?.error?.message || "Couldn't share collection");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (shareId: number) => revokeShare(collectionApikey, shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionShares", collectionApikey] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  if (!open) return null;

  const shares = data?.data ?? [];

  function handleShare(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setError("");
    shareMutation.mutate(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
      />

      <div className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Share Collection</h2>
            <p className="text-xs text-gray-400">{collectionName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Share form */}
        <form onSubmit={handleShare} className="border-b border-gray-100 p-4">
          <label htmlFor="share-email" className="block text-sm font-medium text-gray-700">
            Share with
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
            <button
              type="submit"
              disabled={!email.trim() || shareMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-garnish-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-garnish-700 disabled:opacity-50"
            >
              {shareMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Share
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </form>

        {/* Existing shares */}
        <div className="max-h-64 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : shares.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Not shared with anyone yet.
            </p>
          ) : (
            <div className="space-y-0.5">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-garnish-50 text-sm font-medium text-garnish-600">
                    {share.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {share.user.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">{share.user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(share.id)}
                    disabled={revokeMutation.isPending}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    aria-label={`Remove ${share.user.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
