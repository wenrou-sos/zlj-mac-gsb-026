import { useState } from "react";
import { api } from "../../lib/api";
import { useSpa } from "../../lib/store";
import { formatDuration } from "../../lib/format";

export function QueuePanel() {
  const { state, refresh } = useSpa();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [preferred, setPreferred] = useState("");
  const [error, setError] = useState("");

  if (!state) return null;

  const submit = async () => {
    if (!name.trim()) {
      setError("请填写顾客称呼");
      return;
    }
    setError("");
    try {
      await api.addQueue({ name: name.trim(), phone, partySize, preferred });
      setName("");
      setPhone("");
      setPartySize(1);
      setPreferred("");
      setOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登记失败");
    }
  };

  const seat = async (id: string) => {
    // 引导顾客入座 = 移出队列
    await api.removeQueue(id).catch(() => undefined);
    await refresh();
  };

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
          顾客排队
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-normal text-slate-300">
            {state.queue.length} 人
          </span>
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-500"
        >
          {open ? "收起" : "+ 登记排队"}
        </button>
      </div>

      {open && (
        <div className="mb-4 animate-fade-in space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="顾客称呼 *"
              className={inp}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号（选填）"
              className={inp}
            />
            <input
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              placeholder="人数"
              className={inp}
            />
            <select
              value={preferred}
              onChange={(e) => setPreferred(e.target.value)}
              className={inp}
            >
              <option value="">项目偏好（选填）</option>
              {state.services.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={submit}
            className="w-full rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            加入队列
          </button>
        </div>
      )}

      {state.queue.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">暂无排队</div>
      ) : (
        <div className="space-y-2">
          {state.queue.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                c.overtime
                  ? c.acknowledged
                    ? "border-red-500/25 bg-red-500/5"
                    : "border-red-500/50 bg-red-500/10 animate-pulse-ring"
                  : i === 0
                    ? "border-sky-500/40 bg-sky-500/5"
                    : "border-slate-700 bg-slate-800/60"
              }`}
            >
              <span className="w-6 text-center font-mono text-sm text-slate-500">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-100">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {c.partySize} 人{c.preferred ? ` · ${c.preferred}` : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`font-mono text-sm ${
                      c.overtime ? "font-semibold text-red-300" : "text-slate-400"
                    }`}
                  >
                    已等 {formatDuration(c.waitSec)}
                  </span>
                  {c.overtime && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        c.acknowledged
                          ? "bg-slate-700 text-slate-400"
                          : "bg-red-500/25 text-red-200"
                      }`}
                    >
                      {c.acknowledged ? "已安抚" : "超20分钟·请安抚"}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => void seat(c.id)}
                className="shrink-0 rounded-md bg-emerald-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                入座/离店
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const inp =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500";
