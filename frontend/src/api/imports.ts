import { api } from "./client";
import type { ApiResponse } from "@/types";
import type { ImportSummary } from "@/types/recipe";

export function createUrlImport(url: string) {
  return api<ApiResponse<ImportSummary>>("/imports", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function createFileImport(file: File) {
  // Multipart upload — the api() helper detects FormData and lets the
  // browser set the multipart/form-data Content-Type with its boundary.
  const form = new FormData();
  form.append("file", file);
  return api<ApiResponse<ImportSummary>>("/imports", {
    method: "POST",
    body: form,
  });
}

export function getImport(apikey: string) {
  return api<ApiResponse<ImportSummary>>(`/imports/${apikey}`);
}
