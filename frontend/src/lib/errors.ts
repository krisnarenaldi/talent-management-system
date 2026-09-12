/**
 * Normalise an Axios/API error into a displayable string.
 *
 * FastAPI returns two shapes for `detail`:
 *   - string  → e.g. "Kandidat tidak ditemukan."  (HTTPException)
 *   - array   → e.g. [{type,loc,msg,input,ctx}]   (Pydantic 422 validation)
 *
 * Passing an array directly to React as a child causes "Objects are not valid
 * as a React child" (Error #31).  This helper always returns a plain string.
 */
export type ApiError = {
  response?: {
    status?: number;
    data?: {
      detail?: string | Array<{ msg?: string; loc?: (string | number)[] }>;
    };
  };
};

export function getErrorMessage(error: unknown, fallback = "Terjadi kesalahan."): string {
  const detail = (error as ApiError)?.response?.data?.detail;

  if (!detail) return fallback;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    // Join all Pydantic validation messages into one readable string
    return detail
      .map((e) => {
        const field = e.loc?.slice(1).join(".") ?? "";
        const msg = e.msg ?? "invalid";
        return field ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }

  return fallback;
}
