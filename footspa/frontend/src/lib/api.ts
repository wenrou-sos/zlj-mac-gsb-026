import type { SpaState } from "../types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getState: () => req<SpaState>("/api/state"),

  startSession: (body: {
    techId: string;
    roomId: string;
    serviceId: string;
    customerName?: string;
  }) => req<{ ok: boolean; sessionId: string }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  }),

  endSession: (sessionId: string) =>
    req<{ ok: boolean }>(`/api/sessions/${sessionId}/end`, { method: "POST" }),

  startCleaning: (roomId: string, techId?: string) =>
    req<{ ok: boolean }>(`/api/rooms/${roomId}/cleaning`, {
      method: "POST",
      body: JSON.stringify({ techId: techId ?? null }),
    }),

  finishCleaning: (roomId: string) =>
    req<{ ok: boolean }>(`/api/rooms/${roomId}/cleaned`, { method: "POST" }),

  setTechStatus: (techId: string, status: "idle" | "resting") =>
    req<{ ok: boolean }>(`/api/technicians/${techId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),

  addQueue: (body: {
    name: string;
    phone?: string;
    partySize: number;
    preferred?: string;
  }) =>
    req<{ ok: boolean; id: string }>("/api/queue", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  removeQueue: (customerId: string) =>
    req<{ ok: boolean }>(`/api/queue/${customerId}`, { method: "DELETE" }),

  ackQueue: (customerId: string) =>
    req<{ ok: boolean }>(`/api/queue/${customerId}/ack`, { method: "POST" }),

  ackAllQueue: () =>
    req<{ ok: boolean }>("/api/queue/ack-all", { method: "POST" }),
};
