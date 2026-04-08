import { api } from "./client";
import type { ApiResponse } from "@/types";

export type LlmProvider = "anthropic" | "openai" | "ollama";

export interface UserSettings {
  llm_provider: LlmProvider | null;
  llm_model: string | null;
  has_llm_key: boolean;
}

export interface UserSettingsInput {
  llm_provider?: LlmProvider | null;
  llm_model?: string | null;
  llm_api_key?: string | null;
}

export type LlmTestResult =
  | {
      ok: true;
      provider: LlmProvider;
      model: string;
      reply: string;
    }
  | {
      ok: false;
      error_code: string;
      message: string;
    };

export interface LlmTestInput {
  provider?: LlmProvider | null;
  api_key?: string | null;
  model?: string | null;
}

export function getUserSettings() {
  return api<ApiResponse<UserSettings>>("/user/settings");
}

export function updateUserSettings(input: UserSettingsInput) {
  return api<ApiResponse<UserSettings>>("/user/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function testLlmConnection(input: LlmTestInput = {}) {
  return api<ApiResponse<LlmTestResult>>("/user/settings/test_llm", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
