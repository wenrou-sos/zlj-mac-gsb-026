import { ROOM_STATUS_META, TECH_STATUS_META } from "../types";
import { useSpa } from "../lib/store";
import { formatDuration, yuan } from "../lib/format";

function MetricCard({
  label,
  value,
  unit,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-800/50 p-6 lg:p-8">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`}
      />
      <div className="text-sm font-medium tracking-widest text-slate-400">
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`bg-gradient-to-r ${accent} bg-clip-text font-mono text-6xl font-bold tabular-nums text-transparent lg:text-7xl`}
        >
          {value}
        </span>
        {unit && <span className="text-2xl text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-sm text-slate-500">{sub}</div>}
    </div>
  );
}

export function BigScreen() {
  const { state } = useSpa();
  if (!state) return <div className="p-10 text-center text-slate-400">加载中…</div>;

  const { metrics, technicians, rooms, sessions, queue } = state;
  const sessionByRoom = new Map(sessions.map((s) => [s.roomId, s]));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
      {/* 三大核心指标 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <MetricCard
          label="空闲技师"
          value={metrics.idleTechs}
          unit="人"
          accent="from-emerald-400 to-teal-300"
          sub={`上钟 ${metrics.servingTechs} 人 · 共 ${technicians.length} 名技师`}
        />
        <MetricCard
          label="今日已接待"
          value={metrics.servedToday}
          unit="人"
          accent="from-sky-400 to-indigo-300"
          sub={`当前上钟 ${sessions.length} 位顾客`}
        />
        <MetricCard
          label="今日营收"
          value={yuan(metrics.revenueToday)}
          accent="from-amber-400 to-orange-300"
          sub={`客单价 ${
            metrics.servedToday
              ? yuan(metrics.revenueToday / metrics.servedToday)
              : "¥0"
          }`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* 技师状态墙 */}
        <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-200">
            技师状态
            <span className="text-xs font-normal text-slate-500">
              绿=空闲 红=上钟 黄=打扫 灰=休息
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {technicians.map((t) => {
              const meta = TECH_STATUS_META[t.status];
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border p-3 transition ${
                    t.status === "serving"
                      ? "border-red-500/40 bg-red-500/10"
                      : t.status === "idle"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : t.status === "room_cleaning"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-slate-700 bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${meta.dot} ${
                      t.status === "serving" ? "animate-pulse" : ""
                    }`} />
                    <span className="truncate font-medium text-slate-100">
                      {t.name}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-slate-400">{t.level}</div>
                  <div className={`mt-1 text-sm font-medium ${meta.cell}`}>
                    {meta.label}
                    {t.currentRoomId && t.status === "serving" &&
                      ` · ${rooms.find((r) => r.id === t.currentRoomId)?.name ?? ""}`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 房间状态墙 */}
        <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">房间状态</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
            {rooms.map((r) => {
              const meta = ROOM_STATUS_META[r.status];
              const sess = sessionByRoom.get(r.id);
              return (
                <div
                  key={r.id}
                  className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60 p-3"
                >
                  <div
                    className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${
                      sess
                        ? "from-red-500 to-red-400"
                        : meta.bar
                    }`}
                  />
                  <div className="pl-2">
                    <div className="font-medium text-slate-100">{r.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {sess
                        ? `${sess.techName} · ${sess.serviceName}`
                        : meta.label}
                    </div>
                    {sess && (
                      <div className="mt-0.5 font-mono text-xs text-red-300">
                        剩余 {formatDuration(sess.remainingSec)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-slate-500">
            <span>可用房间 {metrics.availableRooms}</span>
            <span>待打扫 {rooms.filter((r) => r.status === "dirty").length}</span>
            <span>打扫中 {rooms.filter((r) => r.status === "cleaning").length}</span>
          </div>
        </section>

        {/* 排队列表 */}
        <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-5">
          <h2 className="mb-4 flex items-center justify-between text-lg font-semibold text-slate-200">
            顾客排队
            <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-normal text-slate-300">
              {queue.length} 人等待
            </span>
          </h2>
          {queue.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              当前无排队顾客
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((c, i) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    c.overtime
                      ? "border-red-500/50 bg-red-500/10"
                      : i === 0
                        ? "border-sky-500/40 bg-sky-500/5"
                        : "border-slate-700 bg-slate-800/60"
                  }`}
                >
                  <div>
                    <div className="font-medium text-slate-100">
                      <span className="mr-2 text-xs text-slate-500">
                        #{i + 1}
                      </span>
                      {c.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {c.partySize} 人
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {c.preferred || "到店安排"}
                    </div>
                  </div>
                  <div
                    className={`font-mono text-lg font-semibold ${
                      c.overtime ? "text-red-300" : "text-slate-200"
                    }`}
                  >
                    {formatDuration(c.waitSec)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
