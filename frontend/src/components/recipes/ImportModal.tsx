import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Link2, X, Loader2, FileText, Upload } from "lucide-react";
import { createUrlImport, createFileImport } from "@/api/imports";
import type { ApiError } from "@/types";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "url" | "file";

export function ImportModal({ open, onClose }: ImportModalProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when the modal opens; focus the active tab's primary input.
  useEffect(() => {
    if (open) {
      setTab("url");
      setUrl("");
      setFile(null);
      setTimeout(() => urlInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const urlMutation = useMutation({
    mutationFn: (u: string) => createUrlImport(u),
    onSuccess: (res) => {
      onClose();
      navigate(`/recipes/${res.data.id}`);
    },
  });

  const fileMutation = useMutation({
    mutationFn: (f: File) => createFileImport(f),
    onSuccess: (res) => {
      onClose();
      navigate(`/recipes/${res.data.id}`);
    },
  });

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    urlMutation.mutate(trimmed);
  }

  function handleFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    fileMutation.mutate(file);
  }

  if (!open) return null;

  const pending = urlMutation.isPending || fileMutation.isPending;
  const errorMessage =
    (urlMutation.error
      ? (urlMutation.error as ApiError).error?.message
      : null) ??
    (fileMutation.error
      ? (fileMutation.error as ApiError).error?.message
      : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40 transition-opacity"
      />

      {/* Sheet/dialog */}
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Import a recipe</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "url"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Link2 className="h-4 w-4" />
            From URL
          </button>
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "file"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="h-4 w-4" />
            From PDF
          </button>
        </div>

        {tab === "url" && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="import-url"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Recipe URL
              </label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={urlInputRef}
                  id="import-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/recipes/..."
                  disabled={pending}
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500 disabled:opacity-60"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Recipe blogs with structured data parse automatically. For
                blogs without it, we'll use your LLM key (if configured) or
                fall back to extracting whatever metadata we can.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !url.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {urlMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Import
              </button>
            </div>
          </form>
        )}

        {tab === "file" && (
          <form onSubmit={handleFileSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="import-file"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Recipe PDF
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center transition-colors hover:border-garnish-300 hover:bg-garnish-50"
              >
                <Upload className="h-6 w-6 text-gray-400" />
                {file ? (
                  <div className="mt-2 text-sm">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(0)} KB · click to change
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-medium text-gray-700">
                      Tap to choose a PDF
                    </p>
                    <p className="text-xs text-gray-500">
                      Digital cookbooks, ebooks, recipe blog downloads
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={pending}
                className="hidden"
              />
              <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-medium">PDF must contain selectable text.</p>
                <p className="mt-0.5">
                  If you can highlight words in Preview/Acrobat, it'll work.
                  Scanned cookbook pages and photo-based PDFs won't extract
                  yet — those need vision support, coming soon.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !file}
                className="inline-flex items-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {fileMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Import
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
