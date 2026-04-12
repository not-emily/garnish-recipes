import { api } from "./client";
import type { ApiResponse } from "@/types";

export interface RatingDetail {
  user: { id: string; name: string };
  score: number;
}

export interface RatingsData {
  average_rating: number | null;
  rating_count: number;
  my_rating: number | null;
  ratings: RatingDetail[];
}

export interface UpsertResult {
  score: number;
  average_rating: number | null;
  rating_count: number;
}

export function getRatings(recipeApikey: string) {
  return api<ApiResponse<RatingsData>>(`/recipes/${recipeApikey}/ratings`);
}

export function upsertRating(recipeApikey: string, score: number) {
  return api<ApiResponse<UpsertResult>>(`/recipes/${recipeApikey}/ratings`, {
    method: "POST",
    body: JSON.stringify({ rating: { score } }),
  });
}

export function deleteRating(recipeApikey: string) {
  return api<ApiResponse<{ average_rating: number | null; rating_count: number }>>(
    `/recipes/${recipeApikey}/ratings`,
    { method: "DELETE" }
  );
}
