export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
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
