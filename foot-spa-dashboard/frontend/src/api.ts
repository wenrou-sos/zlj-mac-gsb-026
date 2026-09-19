import type { Snapshot } from "./types";

// REST 返回的也是最新快照；操作后 WebSocket 同样会推一份。
async function post<T = Snapshot>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? "" : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `请求失败（${res.status}）`);
  }
  return res.json();
}

export const api = {
  addQueue: (name: string) => post("/api/queue", { name }),
  removeQueue: (id: string) => post(`/api/queue/${id}/remove`),
  startSession: (payload: {
    technicianId: string;
    roomId: string;
    serviceId: string;
    customerName?: string;
    queueId?: string;
  }) => post("/api/sessions", payload),
  finishSession: (id: string) => post(`/api/sessions/${id}/finish`),
  startCleaning: (id: string) => post(`/api/rooms/${id}/clean/start`),
  finishCleaning: (id: string) => post(`/api/rooms/${id}/clean/finish`),
  setRest: (id: string, resting: boolean) =>
    post(`/api/technicians/${id}/rest`, { resting }),
  setDemo: (enabled: boolean) => post("/api/demo", { enabled }),
  reset: () => post("/api/reset"),
};
