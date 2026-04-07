export interface User {
  // Public apikey, exposed as `id` to keep the frontend simple.
  // Internal integer IDs are never exposed by the API.
  id: string;
  email: string;
  name: string;
  has_household: boolean;
  created_at: string;
}

export interface Household {
  id: number;
  name: string;
  default_diners: number;
  leftover_suggestion: "on" | "off" | "ask";
  leftover_default_slot: "breakfast" | "lunch" | "dinner" | "ask";
  invite_code: string | null;
  my_role: "owner" | "admin" | "member";
  my_grocery_permission: "read" | "contribute" | "full";
  member_count: number;
  created_at: string;
}

export interface HouseholdMember {
  id: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  role: "owner" | "admin" | "member";
  grocery_permission: "read" | "contribute" | "full";
  is_me: boolean;
  joined_at: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
