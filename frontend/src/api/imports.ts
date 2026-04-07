import { api } from "./client";
import type { ApiResponse } from "@/types";
import type { ImportSummary } from "@/types/recipe";

export function createUrlImport(url: string) {
  return api<ApiResponse<ImportSummary>>("/imports", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function getImport(apikey: string) {
  return api<ApiResponse<ImportSummary>>(`/imports/${apikey}`);
}
