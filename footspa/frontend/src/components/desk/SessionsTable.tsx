import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useSpa } from "../../lib/store";
import { formatDuration, yuan } from "../../lib/format";
import type { SpaState } from "../../types";

export function StartSessionModal({ onClose }: { onClose: () => void }) {
  const { state, refresh } = useSpa();
  const [techId, setTechId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const occupiedRooms = useMemo(
    () => new Set((state?.sessions ?? []).map((s) => s.roomId)),
    [state?.sessions],
  );

  if (!state) return null;

  const idleTechs = state.technicians.filter((t) => t.status === "idle");
  const freeRooms = state.rooms.filter(
    (r) => r.status === "cleaned" && !occupiedRooms.has(r.id),
  );

  const submit = async () => {
    if (!techId || !roomId || !serviceId) {
      setError("请选择技师、房间和项目");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.startSession({ techId, roomId, serviceId, customerName });
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "开单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-in rounded-2xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-100">新客上钟开单</h2>

        <div className="mt-4 space-y-4">
          <Field label="技师（空闲）">
            <select
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
              className={selectCls}
            >
              <option value="">请选择技师</option>
              {idleTechs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{t.level}）
                </option>
              ))}
            </select>
            {idleTechs.length === 0 && (
              <p className="mt-1 text-xs text-amber-400">暂无空闲技师</p>
            )}
          </Field>

          <Field label="房间（已打扫/可用）">
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={selectCls}
            >
              <option value="">请选择房间</option>
              {freeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {freeRooms.length === 0 && (
              <p className="mt-1 text-xs text-amber-400">暂无可使用房间</p>
            )}
          </Field>

          <Field label="服务项目">
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={selectCls}
            >
              <option value="">请选择项目</option>
              {state.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category} · {s.name}（{s.durationMin}分钟 / {yuan(s.price)}）
                </option>
              ))}
            </select>
          </Field>

          <Field label="顾客称呼（选填）">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="如：陈先生"
              className={selectCls}
            />
          </Field>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
          >
            取消
          </button>
          <button
            disabled={submitting}
            onClick={submit}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {submitting ? "提交中…" : "确认开单"}
          </button>
        </div>
      </div>
    </div>
  );
}

const selectCls =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export function SessionsTable({
  state,
  onOpenModal,
}: {
  state: SpaState;
  onOpenModal: () => void;
}) {
  const { refresh } = useSpa();
  const [busyId, setBusyId] = useState<string | null>(null);

  const endSession = async (id: string) => {
    if (!window.confirm("确认下钟结账？结账后房间将转为「待打扫」。")) return;
    setBusyId(id);
    try {
      await api.endSession(id);
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">
          当前上钟情况
          <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-normal text-red-300">
            {state.sessions.length} 人上钟中
          </span>
        </h2>
        <button
          onClick={onOpenModal}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          + 新客上钟
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 font-medium">技师</th>
              <th className="px-3 py-2.5 font-medium">房间</th>
              <th className="px-3 py-2.5 font-medium">项目</th>
              <th className="px-3 py-2.5 font-medium">顾客</th>
              <th className="px-3 py-2.5 font-medium">已做多久</th>
              <th className="w-56 px-3 py-2.5 font-medium">进度 / 预计剩余</th>
              <th className="px-3 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {state.sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                  暂无上钟记录，点击右上角「新客上钟」开单
                </td>
              </tr>
            )}
            {state.sessions.map((s) => {
              const totalSec = s.durationMin * 60;
              const pct = Math.min(100, (s.elapsedSec / totalSec) * 100);
              return (
                <tr
                  key={s.id}
                  className="border-b border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="px-3 py-3">
                    <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
                    <span className="font-medium text-slate-100">{s.techName}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{s.roomName}</td>
                  <td className="px-3 py-3">
                    <div className="text-slate-200">{s.serviceName}</div>
                    <div className="text-xs text-slate-500">
                      {s.durationMin}分钟 · {yuan(s.price)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{s.customerName}</td>
                  <td className="px-3 py-3 font-mono text-slate-200">
                    {formatDuration(s.elapsedSec)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            s.overdue
                              ? "bg-red-500"
                              : s.remainingSec <= 10 * 60
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={`w-20 shrink-0 text-right font-mono text-xs ${
                          s.overdue
                            ? "text-red-400"
                            : s.remainingSec <= 10 * 60
                              ? "text-amber-300"
                              : "text-slate-400"
                        }`}
                      >
                        {s.overdue
                          ? `超时 ${formatDuration(s.overdueSec)}`
                          : `剩 ${formatDuration(s.remainingSec)}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      disabled={busyId === s.id}
                      onClick={() => void endSession(s.id)}
                      className="rounded-md bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      下钟结账
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
