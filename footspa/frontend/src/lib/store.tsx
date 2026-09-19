import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { QueueCustomer, SpaState } from "../types";

const WAIT_ALERT_SECONDS = 20 * 60;

function applyTick(prev: SpaState, now: number): SpaState {
  return {
    ...prev,
    now,
    sessions: prev.sessions.map((s) => ({
      ...s,
      elapsedSec: Math.max(0, Math.floor(now - s.startedAt)),
      remainingSec: Math.max(0, Math.floor(s.endAt - now)),
      overdueSec: Math.max(0, Math.floor(now - s.endAt)),
      overdue: now > s.endAt,
    })),
    queue: prev.queue.map((c) => {
      const waitSec = Math.max(0, Math.floor(now - c.arrivedAt));
      return { ...c, waitSec, overtime: waitSec >= WAIT_ALERT_SECONDS };
    }),
  };
}

interface SpaContextValue {
  state: SpaState | null;
  connected: boolean;
  /** 已超 20 分钟且前台尚未确认的排队顾客（用于弹窗） */
  activeAlerts: QueueCustomer[];
  refresh: () => Promise<void>;
}

const SpaContext = createContext<SpaContextValue | null>(null);

export function SpaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SpaState | null>(null);
  const [connected, setConnected] = useState(false);
  const offsetRef = useRef(0); // 服务端时钟 - 客户端时钟（秒）

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/ws`);

      ws.onopen = () => setConnected(true);

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as
          | { type: "state"; data: SpaState }
          | { type: "tick"; data: { now: number } };

        if (msg.type === "state") {
          offsetRef.current = msg.data.now - Date.now() / 1000;
          setState(msg.data);
        } else {
          offsetRef.current = msg.data.now - Date.now() / 1000;
          setState((prev) => (prev ? applyTick(prev, msg.data.now) : prev));
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closed) reconnect = setTimeout(connect, 2000);
      };
    };

    connect();
    void api.getState().then(setState).catch(() => undefined);

    // 断线时也能本地走秒
    const timer = setInterval(() => {
      setState((prev) =>
        prev ? applyTick(prev, Date.now() / 1000 + offsetRef.current) : prev,
      );
    }, 1000);

    return () => {
      closed = true;
      clearTimeout(reconnect);
      clearInterval(timer);
      ws?.close();
    };
  }, []);

  const activeAlerts = useMemo(
    () =>
      (state?.queue ?? []).filter((c) => c.overtime && !c.acknowledged),
    [state?.queue],
  );

  const refresh = async () => {
    setState(await api.getState());
  };

  return (
    <SpaContext.Provider value={{ state, connected, activeAlerts, refresh }}>
      {children}
    </SpaContext.Provider>
  );
}

export function useSpa(): SpaContextValue {
  const ctx = useContext(SpaContext);
  if (!ctx) throw new Error("useSpa 必须在 SpaProvider 内使用");
  return ctx;
}
