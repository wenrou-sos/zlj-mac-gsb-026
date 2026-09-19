import { api } from "../../lib/api";
import { useSpa } from "../../lib/store";
import { TechStatusBadge } from "../StatusBadges";

export function TechsPanel() {
  const { state, refresh } = useSpa();
  if (!state) return null;

  const toggleRest = async (techId: string, resting: boolean) => {
    try {
      await api.setTechStatus(techId, resting ? "resting" : "idle");
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-5">
      <h2 className="mb-1 text-lg font-semibold text-slate-200">技师排班</h2>
      <p className="mb-4 text-xs text-slate-500">
        绿=空闲 · 红=上钟 · 黄=打扫房间中 · 灰=休息/吃饭（仅空闲与休息可手动切换）
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {state.technicians.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-100">
                  {t.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{t.level}</span>
              </div>
              <div className="mt-1">
                <TechStatusBadge status={t.status} />
              </div>
            </div>
            {(t.status === "idle" || t.status === "resting") && (
              <button
                onClick={() => void toggleRest(t.id, t.status === "idle")}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  t.status === "resting"
                    ? "bg-emerald-600/90 text-white hover:bg-emerald-500"
                    : "bg-slate-600 text-slate-200 hover:bg-slate-500"
                }`}
              >
                {t.status === "resting" ? "返岗" : "休息/吃饭"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
