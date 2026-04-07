import { api } from "./client";
import type { ApiResponse, Household, HouseholdMember } from "@/types";

export function createHousehold(data: { name: string; default_diners?: number }) {
  return api<ApiResponse<Household>>("/households", {
    method: "POST",
    body: JSON.stringify({ household: data }),
  });
}

export function joinHousehold(inviteCode: string) {
  return api<ApiResponse<Household>>("/households/join", {
    method: "POST",
    body: JSON.stringify({ invite_code: inviteCode }),
  });
}

export function getCurrentHousehold() {
  return api<ApiResponse<Household>>("/households/current");
}

export function updateHousehold(data: Partial<Household>) {
  return api<ApiResponse<Household>>("/households/current", {
    method: "PATCH",
    body: JSON.stringify({ household: data }),
  });
}

export function regenerateInviteCode() {
  return api<ApiResponse<{ invite_code: string }>>(
    "/households/current/regenerate_invite",
    { method: "POST" }
  );
}

export function getMembers() {
  return api<ApiResponse<HouseholdMember[]>>("/households/current/members");
}

export function updateMember(
  id: number,
  data: { role?: string; grocery_permission?: string }
) {
  return api<ApiResponse<HouseholdMember>>(
    `/households/current/members/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export function removeMember(id: number) {
  return api<void>(`/households/current/members/${id}`, {
    method: "DELETE",
  });
}
