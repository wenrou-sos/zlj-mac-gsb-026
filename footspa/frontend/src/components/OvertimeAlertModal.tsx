import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useSpa } from "../lib/store";
import { formatDuration } from "../lib/format";
import type { QueueCustomer } from "../types";

/**
 * 排队超过 20 分钟自动弹窗，建议前台安抚。
 * - 单条「已安抚」/ 底部「全部已知晓」：写回后端，不再提示
 * - 「5 分钟后再提醒」：仅本地暂缓当前这批顾客
 */
export function OvertimeAlertModal() {
  const { activeAlerts } = useSpa();
  const [snoozedIds, setSnoozedIds] = useState<string[]>([]);

  const showing = useMemo(
    () => activeAlerts.filter((c) => !snoozedIds.includes(c.id)),
    [activeAlerts, snoozedIds],
  );

  // 浏览器通知（标签页不在前台时也能提醒）
  useEffect(() => {
    if (showing.length > 0 && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [showing.length]);

  useEffect(() => {
    if (showing.length > 0 && "Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("顾客等待超时提醒", {
        body: `${showing.length} 位顾客排队已超过 20 分钟，建议前台尽快安抚`,
      });
    }
  }, [showing.length]);

  if (showing.length === 0) return null;

  const ackOne = async (c: QueueCustomer) => {
    await api.ackQueue(c.id).catch(() => undefined);
  };

  const ackAll = async () => {
    await api.ackAllQueue().catch(() => undefined);
    setSnoozedIds([]);
  };

  const snooze = () => {
    setSnoozedIds((prev) =>
      Array.from(new Set([...prev, ...showing.map((c) => c.id)])),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-fade-in overflow-hidden rounded-2xl border border-red-500/40 bg-slate-900 shadow-2xl shadow-red-900/30">
        <div className="flex items-center gap-3 border-b border-red-500/30 bg-red-500/10 px-6 py-4">
          <span className="flex h-10 w-10 animate-pulse-ring items-center justify-center rounded-full bg-red-500/20 text-xl">
            ⏰
          </span>
          <div>
            <h2 className="text-lg font-semibold text-red-200">
              顾客等待已超过 20 分钟
            </h2>
            <p className="text-sm text-red-300/80">
              建议前台主动上前安抚（送茶水 / 告知预计等待时间）
            </p>
          </div>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto px-6 py-4">
          {showing.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg bg-slate-800/70 px-4 py-3"
            >
              <div>
                <div className="font-medium text-slate-100">
                  {c.name}
                  <span className="ml-2 text-xs text-slate-400">
                    {c.partySize} 人 · {c.preferred || "暂无偏好"}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-sm text-red-300">
                  已等待 {formatDuration(c.waitSec)}
                </div>
              </div>
              <button
                onClick={() => void ackOne(c)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                已安抚
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-6 py-3">
          <button
            onClick={snooze}
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            5 分钟后再提醒
          </button>
          <button
            onClick={() => void ackAll()}
            className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500"
          >
            全部已知晓
          </button>
        </div>
      </div>
    </div>
  );
}
