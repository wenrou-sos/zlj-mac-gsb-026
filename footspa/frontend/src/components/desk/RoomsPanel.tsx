import { useState } from "react";
import { api } from "../../lib/api";
import { useSpa } from "../../lib/store";
import { ROOM_STATUS_META } from "../../types";
import type { Room } from "../../types";

/**
 * 房间状态面板：
 * 待打扫 -> 点击「开始打扫」（可指派空闲技师）-> 打扫中 -> 「保洁完成」-> 已打扫（可用）
 */
export function RoomsPanel() {
  const { state, refresh } = useSpa();
  const [pickRoom, setPickRoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!state) return null;

  const sessionByRoom = new Map(state.sessions.map((s) => [s.roomId, s]));
  const idleTechs = state.technicians.filter((t) => t.status === "idle");

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
      setPickRoom(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-200">房间保洁</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {state.rooms.map((room) => {
          const sess = sessionByRoom.get(room.id);
          const cleaner = state.technicians.find(
            (t) => t.status === "room_cleaning" && t.currentRoomId === room.id,
          );
          return (
            <RoomCard
              key={room.id}
              room={room}
              occupied={!!sess}
              occupant={sess ? `${sess.techName} · ${sess.serviceName}` : ""}
              cleanerName={cleaner?.name}
              busy={busy}
              picking={pickRoom === room.id}
              idleTechNames={idleTechs.map((t) => ({ id: t.id, name: t.name }))}
              onStartPick={() => setPickRoom(room.id)}
              onCancelPick={() => setPickRoom(null)}
              onStart={(techId) =>
                call(() => api.startCleaning(room.id, techId || undefined))
              }
              onFinish={() => call(() => api.finishCleaning(room.id))}
            />
          );
        })}
      </div>
    </section>
  );
}

function RoomCard(props: {
  room: Room;
  occupied: boolean;
  occupant: string;
  cleanerName?: string;
  busy: boolean;
  picking: boolean;
  idleTechNames: { id: string; name: string }[];
  onStartPick: () => void;
  onCancelPick: () => void;
  onStart: (techId: string) => void;
  onFinish: () => void;
}) {
  const { room } = props;
  const meta = ROOM_STATUS_META[room.status];
  const [techId, setTechId] = useState("");

  return (
    <div
      className={`rounded-xl border p-4 ${
        props.occupied
          ? "border-red-500/30 bg-red-500/5"
          : room.status === "dirty"
            ? "border-orange-500/30 bg-orange-500/5"
            : room.status === "cleaning"
              ? "border-sky-500/30 bg-sky-500/5"
              : "border-emerald-500/25 bg-emerald-500/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-100">{room.name}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            props.occupied
              ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/40"
              : meta.badge
          }`}
        >
          {props.occupied ? "使用中" : meta.label}
        </span>
      </div>

      {props.occupied && (
        <p className="mt-2 text-xs text-slate-400">{props.occupant}</p>
      )}
      {room.status === "cleaning" && (
        <p className="mt-2 text-xs text-sky-300/80">
          {props.cleanerName ? `${props.cleanerName} 正在打扫` : "保洁打扫中…"}
        </p>
      )}

      <div className="mt-3">
        {room.status === "dirty" && !props.occupied && (
          props.picking ? (
            <div className="space-y-2">
              <select
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="">保洁自行打扫（不指派技师）</option>
                {props.idleTechNames.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  disabled={props.busy}
                  onClick={() => props.onStart(techId)}
                  className="flex-1 rounded-md bg-sky-600 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  确认开始
                </button>
                <button
                  onClick={props.onCancelPick}
                  className="rounded-md px-2 text-xs text-slate-400 hover:bg-slate-700"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled={props.busy}
              onClick={props.onStartPick}
              className="w-full rounded-md bg-orange-600 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-50"
            >
              开始打扫
            </button>
          )
        )}

        {room.status === "cleaning" && (
          <button
            disabled={props.busy}
            onClick={props.onFinish}
            className="w-full rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            ✓ 保洁完成（点击变为可用）
          </button>
        )}

        {room.status === "cleaned" && !props.occupied && (
          <div className="text-center text-xs text-emerald-400/80">
            可直接安排上钟
          </div>
        )}
      </div>
    </div>
  );
}
