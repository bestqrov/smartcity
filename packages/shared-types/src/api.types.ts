// ─── Generic API Response ────────────────────────────────────────────────────

export interface IApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: IApiError[];
}

// ─── Paginated Response ──────────────────────────────────────────────────────

export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Pagination Query ────────────────────────────────────────────────────────

export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface IApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
