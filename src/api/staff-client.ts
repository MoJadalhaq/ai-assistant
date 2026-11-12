import type {
  ResetDemoSuccess,
  ResolveTicketSuccess,
  StaffErrorCode,
  StaffOverview,
} from "../../shared/api-types.ts";

export type StaffClientError = StaffErrorCode | "network_error";

type Result<T> = T | { ok: false; error: StaffClientError; retryAfterSeconds?: number };

/** Same rule as the chat client: never throws, every failure becomes an error code the page can explain. */
async function request<T extends { ok: true }>(path: string, init?: RequestInit): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    return { ok: false, error: "network_error" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === "object" && body !== null && "ok" in body) return body as Result<T>;
  return { ok: false, error: "internal_error" };
}

export function fetchOverview() {
  return request<StaffOverview>("/api/staff/overview", { cache: "no-store" });
}

export function resolveTicket(id: number) {
  return request<ResolveTicketSuccess>(`/api/staff/tickets/${id}/resolve`, { method: "POST" });
}

export function resetDemoData() {
  return request<ResetDemoSuccess>("/api/staff/reset", { method: "POST" });
}
