import type { Snapshot } from "../types";
import { TECH_STATUS_META, ROOM_STATUS_META, QUEUE_ALERT_MS } from "../types";
import { fmtClock, fmtDate, fmtWait, yuan, byId } from "../utils/format";

interface Props {
  snap: Snapshot;
  now: number;
}

export default function BigScreen({ snap, now }: Props) {
  const { stats, technicians, rooms, sessions, queue } = snap;
  const techMap = byId(technicians);
  const roomMap = byId(rooms);
  const overCount = queue.filter((q) => now - q.joinedAt > QUEUE_ALERT_MS).length;

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="brand">
          <span className="brand-logo">足</span>
          <div>
            <h1>悦足堂 · 实时运营中心</h1>
            <p>{fmtDate(now)}</p>
          </div>
        </div>
        <div className="screen-clock">
          <span className="clock-time">{fmtClock(now)}</span>
          <span className="clock-live">
            <i className="live-dot" /> 实时
          </span>
        </div>
      </header>

      {/* 核心三指标 */}
      <section className="kpi-row">
        <div className="kpi kpi-green">
          <div className="kpi-label">空闲技师</div>
          <div className="kpi-value">
            {stats.idle}
            <small>人</small>
          </div>
          <div className="kpi-sub">共 {technicians.length} 位技师在岗</div>
        </div>
        <div className="kpi kpi-blue">
          <div className="kpi-label">今日已接待</div>
          <div className="kpi-value">
            {stats.served}
            <small>位顾客</small>
          </div>
          <div className="kpi-sub">上钟中 {sessions.length} 位</div>
        </div>
        <div className="kpi kpi-gold">
          <div className="kpi-label">今日营收</div>
          <div className="kpi-value kpi-money">
            {yuan(stats.revenue)}
          </div>
          <div className="kpi-sub">
            客单价 {stats.served ? yuan(Math.round(stats.revenue / stats.served)) : "¥0"}
          </div>
        </div>
      </section>

      <section className="screen-grid">
        {/* 技师一览 */}
        <div className="tv-panel">
          <h2>技师动态</h2>
          <div className="tv-tech-grid">
            {technicians.map((t) => {
              const meta = TECH_STATUS_META[t.status];
              const room = t.roomId ? roomMap[t.roomId] : null;
              return (
                <div key={t.id} className={`tv-tech tone-${meta.cls}`}>
                  <div className="tv-tech-name">{t.name}</div>
                  <div className="tv-tech-status">{meta.label}</div>
                  {room && <div className="tv-tech-room">{room.name}</div>}
                </div>
              );
            })}
          </div>
          <div className="tv-legend">
            {(["idle", "busy", "cleaning", "resting"] as const).map((k) => (
              <span key={k}>
                <i className={`dot tone-${TECH_STATUS_META[k].cls}`} />
                {TECH_STATUS_META[k].label}
              </span>
            ))}
          </div>
        </div>

        {/* 房间一览 */}
        <div className="tv-panel">
          <h2>房间状态</h2>
          <div className="tv-room-grid">
            {rooms.map((r) => {
              const meta = ROOM_STATUS_META[r.status];
              const tech = r.technicianId ? techMap[r.technicianId] : null;
              return (
                <div key={r.id} className={`tv-room tone-${meta.cls}`}>
                  <div className="tv-room-name">{r.name}</div>
                  <div className="tv-room-status">{meta.label}</div>
                  {tech && <div className="tv-room-tech">{tech.name}</div>}
                </div>
              );
            })}
          </div>
          <div className="tv-legend">
            {(["clean", "occupied", "dirty", "cleaning"] as const).map((k) => (
              <span key={k}>
                <i className={`dot tone-${ROOM_STATUS_META[k].cls}`} />
                {ROOM_STATUS_META[k].label}
              </span>
            ))}
          </div>
        </div>

        {/* 排队情况 */}
        <div className="tv-panel">
          <h2>
            顾客排队
            <span className={`tv-queue-count ${overCount ? "danger" : ""}`}>
              {queue.length} 人等待{overCount ? ` · ${overCount} 人超时` : ""}
            </span>
          </h2>
          {queue.length === 0 ? (
            <div className="tv-empty">暂无排队顾客</div>
          ) : (
            <ul className="tv-queue">
              {queue.map((q, i) => {
                const wait = now - q.joinedAt;
                const over = wait > QUEUE_ALERT_MS;
                return (
                  <li key={q.id} className={over ? "over" : ""}>
                    <span className="tv-q-index">#{i + 1}</span>
                    <span className="tv-q-name">{q.name}</span>
                    <span className="tv-q-wait">
                      已等待 {fmtWait(wait)}
                      {over && <em> · 建议安抚</em>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="tv-note">排队超过 20 分钟，前台将收到安抚提醒</div>
        </div>
      </section>

      <a className="switch-link" href="#/desk">
        → 前台操作视图
      </a>
    </div>
  );
}
