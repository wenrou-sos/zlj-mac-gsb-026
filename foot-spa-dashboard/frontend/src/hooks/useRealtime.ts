import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "../types";

/**
 * 订阅后端实时状态：
 * - WebSocket 连接，收到的全量快照直接替换
 * - 断线 / 浏览器不支持时，降级为每 2 秒轮询 /api/state
 * - now 本地每 500ms 刷新，驱动“已做多久/等待时长”的秒级走动
 */
export function useRealtime() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(async () => {
    stopPoll();
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/state");
        if (res.ok) {
          const data: Snapshot = await res.json();
          setSnap(data);
        }
      } catch {
        /* 等下一轮 */
      }
    };
    await fetchOnce();
    pollRef.current = window.setInterval(fetchOnce, 2000);
  }, [stopPoll]);

  const connect = useCallback(() => {
    let ws: WebSocket;
    try {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${location.host}/ws`);
    } catch {
      startPoll();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      stopPoll();
    };
    ws.onmessage = (ev) => {
      try {
        setSnap(JSON.parse(ev.data) as Snapshot);
      } catch {
        /* 忽略坏包 */
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (reconnectRef.current === null) {
        reconnectRef.current = window.setTimeout(() => {
          reconnectRef.current = null;
          connect();
        }, 3000);
      }
      startPoll();
    };
    ws.onerror = () => ws.close();
  }, [startPoll, stopPoll]);

  useEffect(() => {
    connect();
    const clock = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      window.clearInterval(clock);
      if (reconnectRef.current !== null) window.clearTimeout(reconnectRef.current);
      stopPoll();
      wsRef.current?.close();
    };
  }, [connect, stopPoll]);

  return { snap, connected, now };
}
