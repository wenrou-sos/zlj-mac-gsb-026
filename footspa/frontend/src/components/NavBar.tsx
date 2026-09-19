import { NavLink } from "react-router-dom";
import { useSpa } from "../lib/store";
import { formatClock } from "../lib/format";

const tabs = [
  { to: "/", label: "门口大屏", end: true },
  { to: "/desk", label: "前台平板" },
];

export function NavBar() {
  const { state, connected } = useSpa();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
        <span className="text-base font-semibold tracking-wide text-slate-100">
          <span className="mr-2">🦶</span>悦足轩 · 实时运营面板
        </span>
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm text-slate-400">
          <span className="hidden font-mono sm:inline">
            {state ? formatClock(state.now) : "--:--:--"}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"
              }`}
            />
            {connected ? "实时连接" : "重连中…"}
          </span>
        </div>
      </div>
    </header>
  );
}
