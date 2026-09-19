import { useState } from "react";
import { useSpa } from "../lib/store";
import { yuan } from "../lib/format";
import { SessionsTable, StartSessionModal } from "../components/desk/SessionsTable";
import { QueuePanel } from "../components/desk/QueuePanel";
import { RoomsPanel } from "../components/desk/RoomsPanel";
import { TechsPanel } from "../components/desk/TechsPanel";

export function FrontDesk() {
  const { state } = useSpa();
  const [showStart, setShowStart] = useState(false);
  if (!state) return <div className="p-10 text-center text-slate-400">加载中…</div>;

  const { metrics } = state;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 lg:p-6">
      {/* 顶部小指标条 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="空闲技师" value={String(metrics.idleTechs)} tone="text-emerald-400" />
        <MiniStat label="上钟中" value={String(metrics.servingTechs)} tone="text-red-400" />
        <MiniStat label="今日已接待" value={`${metrics.servedToday} 人`} tone="text-sky-400" />
        <MiniStat label="今日营收" value={yuan(metrics.revenueToday)} tone="text-amber-400" />
      </div>

      <SessionsTable state={state} onOpenModal={() => setShowStart(true)} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <QueuePanel />
        <RoomsPanel />
      </div>

      <TechsPanel />

      {showStart && <StartSessionModal onClose={() => setShowStart(false)} />}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-800/40 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${tone}`}>
        {value}
      </div>
    </div>
  );
}
