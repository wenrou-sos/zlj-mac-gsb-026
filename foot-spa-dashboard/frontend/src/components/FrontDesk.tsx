import { useEffect, useMemo, useRef, useState } from "react";
import type { Snapshot, QueueEntry } from "../types";
import { QUEUE_ALERT_MS, TECH_STATUS_META, ROOM_STATUS_META } from "../types";
import { api } from "../api";
import { fmtElapsed, fmtRemaining, fmtWait, byId } from "../utils/format";
import StartSessionModal from "./StartSessionModal";

interface Props {
  snap: Snapshot;
  now: number;
}

export default function FrontDesk({ snap, now }: Props) {
  const { sessions, technicians, rooms, queue, stats, demo } = snap;
  const techMap = useMemo(() => byId(technicians), [technicians]);
  const roomMap = useMemo(() => byId(rooms), [rooms]);

  const [showStart, setShowStart] = useState(false);
  const [presetQueueId, setPresetQueueId] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 超过 20 分钟的排队顾客：每个只弹一次
  const alertedRef = useRef<Set<string>>(new Set());
  const [alertQueue, setAlertQueue] = useState<QueueEntry[]>([]);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const overdue = queue.filter(
      (q) => now - q.joinedAt > QUEUE_ALERT_MS && !alertedRef.current.has(q.id)
    );
    if (overdue.length > 0) {
      overdue.forEach((q) => alertedRef.current.add(q.id));
      setAlertQueue(overdue);
      setShowAlert(true);
    }
    // 顾客被安排/移除后，从待提示列表清掉
    setAlertQueue((prev) =>
      prev.filter((p) => queue.some((q) => q.id === p.id))
    );
  }, [queue, now]);

  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMsg) setToast(okMsg);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  };

  const openStart = (queueId?: string) => {
    setPresetQueueId(queueId);
    setShowStart(true);
  };

  const overIds = new Set(
    queue.filter((q) => now - q.joinedAt > QUEUE_ALERT_MS).map((q) => q.id)
  );

  return (
    <div className="desk">
      <header className="desk-head">
        <div className="desk-title">
          <h1>前台调度台</h1>
          <div className="desk-kpis">
            <span><b className="txt-green">{stats.idle}</b> 空闲</span>
            <span><b className="txt-red">{stats.busy}</b> 上钟</span>
            <span><b className="txt-yellow">{stats.cleaning}</b> 打扫</span>
            <span><b className="txt-gray">{stats.resting}</b> 休息</span>
            <span>已接待 <b>{stats.served}</b></span>
            <span className="txt-gold"><b>¥{stats.revenue.toLocaleString("zh-CN")}</b></span>
          </div>
        </div>
        <div className="desk-actions">
          <button className="btn" onClick={() => run(() => api.setDemo(!demo))}>
            {demo ? "⏸ 关闭演示模式" : "▶ 演示自动流转"}
          </button>
          <button className="btn btn-ghost" onClick={() => run(() => api.reset())}>
            ↺ 重置数据
          </button>
          <a className="btn btn-ghost" href="#/screen">大屏视图</a>
          <button className="btn btn-primary" onClick={() => openStart()}>
            ＋ 开单上钟
          </button>
        </div>
      </header>

      <div className="desk-grid">
        {/* 当前上钟表 */}
        <section className="panel panel-sessions">
          <h2>当前上钟（{sessions.length}）</h2>
          <div className="table-wrap">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>技师</th>
                  <th>房间</th>
                  <th>项目</th>
                  <th>顾客</th>
                  <th>已做</th>
                  <th>预计剩余</th>
                  <th>进度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-empty">当前没有上钟中的服务，点击右上角「开单上钟」</td>
                  </tr>
                )}
                {sessions.map((s) => {
                  const elapsed = now - s.startedAt;
                  const remaining = s.durationSec * 1000 - elapsed;
                  const pct = Math.min(100, Math.max(0, (elapsed / (s.durationSec * 1000)) * 100));
                  const overtime = remaining < 0;
                  return (
                    <tr key={s.id} className={overtime ? "row-overtime" : ""}>
                      <td>
                        <i className="dot tone-red" />
                        {techMap[s.technicianId]?.name ?? s.technicianId}
                      </td>
                      <td>{roomMap[s.roomId]?.name ?? s.roomId}</td>
                      <td className="cell-service">
                        {s.serviceName}
                        <small>¥{s.price}</small>
                      </td>
                      <td>{s.customerName}</td>
                      <td className="cell-elapsed">{fmtElapsed(elapsed)}</td>
                      <td className={overtime ? "txt-red strong" : ""}>
                        {fmtRemaining(remaining)}
                      </td>
                      <td>
                        <div className={`progress ${overtime ? "over" : ""}`}>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-small btn-warn"
                          disabled={busy}
                          onClick={() => run(() => api.finishSession(s.id), "已下钟，房间转待打扫")}
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

        {/* 排队 */}
        <section className="panel panel-queue">
          <h2>
            顾客排队（{queue.length}）
            {overIds.size > 0 && (
              <button className="btn btn-small btn-danger" onClick={() => setShowAlert(true)}>
                {overIds.size} 人等待超 20 分钟，去安抚
              </button>
            )}
          </h2>
          <AddQueue onAdd={(name) => run(() => api.addQueue(name), "已加入排队")} disabled={busy} />
          {queue.length === 0 ? (
            <div className="panel-empty">暂无排队</div>
          ) : (
            <ul className="queue-list">
              {queue.map((q, i) => {
                const wait = now - q.joinedAt;
                const over = wait > QUEUE_ALERT_MS;
                return (
                  <li key={q.id} className={over ? "over" : ""}>
                    <div className="queue-main">
                      <span className="queue-index">#{i + 1}</span>
                      <span className="queue-name">{q.name}</span>
                      {over && <span className="badge-danger">超时</span>}
                    </div>
                    <div className="queue-wait">已等 {fmtWait(wait)}</div>
                    <div className="queue-btns">
                      <button
                        className="btn btn-small btn-primary"
                        disabled={busy}
                        onClick={() => openStart(q.id)}
                      >
                        安排上钟
                      </button>
                      <button
                        className="btn btn-small btn-ghost"
                        disabled={busy}
                        onClick={() => run(() => api.removeQueue(q.id))}
                      >
                        取消
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 技师 */}
        <section className="panel panel-tech">
          <h2>技师（{technicians.length}）</h2>
          <div className="card-grid">
            {technicians.map((t) => {
              const meta = TECH_STATUS_META[t.status];
              const room = t.roomId ? roomMap[t.roomId] : null;
              return (
                <div key={t.id} className={`mini-card tone-${meta.cls}`}>
                  <div className="mini-name">{t.name}</div>
                  <div className="mini-status">{meta.label}</div>
                  {room && <div className="mini-sub">{room.name}</div>}
                  {t.status === "idle" && (
                    <button
                      className="btn btn-small btn-ghost"
                      disabled={busy}
                      onClick={() => run(() => api.setRest(t.id, true), `${t.name} 已休息`)}
                    >
                      去休息
                    </button>
                  )}
                  {t.status === "resting" && (
                    <button
                      className="btn btn-small btn-green"
                      disabled={busy}
                      onClick={() => run(() => api.setRest(t.id, false), `${t.name} 已回岗`)}
                    >
                      回岗
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="dot tone-green" />空闲</span>
            <span><i className="dot tone-red" />上钟</span>
            <span><i className="dot tone-yellow" />待打扫房间中</span>
            <span><i className="dot tone-gray" />休息/吃饭</span>
          </div>
        </section>

        {/* 房间 */}
        <section className="panel panel-room">
          <h2>房间（{rooms.length}）</h2>
          <div className="card-grid">
            {rooms.map((r) => {
              const meta = ROOM_STATUS_META[r.status];
              const tech = r.technicianId ? techMap[r.technicianId] : null;
              return (
                <div key={r.id} className={`mini-card room-card tone-${meta.cls}`}>
                  <div className="mini-name">{r.name}</div>
                  <div className="mini-status">{meta.label}</div>
                  {tech && <div className="mini-sub">{tech.name}</div>}
                  {r.status === "dirty" && (
                    <button
                      className="btn btn-small btn-blue"
                      disabled={busy}
                      onClick={() => run(() => api.startCleaning(r.id))}
                    >
                      开始打扫
                    </button>
                  )}
                  {r.status === "cleaning" && (
                    <button
                      className="btn btn-small btn-green"
                      disabled={busy}
                      onClick={() => run(() => api.finishCleaning(r.id), `${r.name} 已可用`)}
                    >
                      ✓ 保洁完成
                    </button>
                  )}
                  {r.status === "clean" && <div className="mini-tag">可直接排房</div>}
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="dot tone-green" />已打扫</span>
            <span><i className="dot tone-yellow" />待打扫</span>
            <span><i className="dot tone-blue" />打扫中</span>
            <span><i className="dot tone-red" />上钟中</span>
          </div>
        </section>
      </div>

      {showStart && (
        <StartSessionModal
          snap={snap}
          presetQueueId={presetQueueId}
          busy={busy}
          onClose={() => setShowStart(false)}
        />
      )}

      {/* 超过 20 分钟自动弹窗：建议前台安抚 */}
      {showAlert && alertQueue.length > 0 && (
        <div className="modal-mask" onClick={() => setShowAlert(false)}>
          <div className="modal alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="alert-icon">⏰</div>
            <h2>等待超时提醒</h2>
            <p className="alert-text">
              以下顾客已等待 <b className="txt-red">超过 20 分钟</b>，建议前台主动上前安抚
              （送茶水 / 小吃，告知预计排到时间）：
            </p>
            <ul className="alert-list">
              {alertQueue.map((q) => (
                <li key={q.id}>
                  <b>{q.name}</b>
                  <span className={overIds.has(q.id) ? "txt-red" : ""}>
                    已等待 {fmtWait(now - q.joinedAt)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowAlert(false)}>稍后处理</button>
              <button className="btn btn-primary" onClick={() => { setShowAlert(false); openStart(alertQueue[0].id); }}>
                立即安排上钟
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function AddQueue({ onAdd, disabled }: { onAdd: (name: string) => void; disabled: boolean }) {
  const [name, setName] = useState("");
  return (
    <form
      className="add-queue"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim());
        setName("");
      }}
    >
      <input
        value={name}
        disabled={disabled}
        placeholder="顾客称呼，如：王先生"
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn btn-primary btn-small" disabled={disabled || !name.trim()}>
        取号排队
      </button>
    </form>
  );
}
