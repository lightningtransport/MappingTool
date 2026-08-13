import axios from "axios";

export function sanitizeError(error: unknown): { status: number | null; message: string } {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    if (status === 401) return { status, message: "401 Unauthorized" };
    if (status === 403) return { status, message: "403 Forbidden" };
    if (status === 404) return { status, message: "404 Not Found" };
    if (error.code === "ECONNABORTED") return { status, message: "Connection timed out" };
    return { status, message: status ? `Ninox request failed (${status})` : "Ninox connection failed" };
  }
  return { status: null, message: "Unexpected Ninox client error" };
}
