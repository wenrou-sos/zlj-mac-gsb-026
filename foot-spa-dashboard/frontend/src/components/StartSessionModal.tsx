import { useMemo, useState } from "react";
import type { Snapshot } from "../types";
import { api } from "../api";

interface Props {
  snap: Snapshot;
  presetQueueId?: string;
  busy: boolean;
  onClose: () => void;
}

export default function StartSessionModal({ snap, presetQueueId, busy, onClose }: Props) {
  const { technicians, rooms, services, queue } = snap;

  const presetCustomer = presetQueueId
    ? queue.find((q) => q.id === presetQueueId)?.name
    : undefined;

  const [technicianId, setTechnicianId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [customerName, setCustomerName] = useState(presetCustomer ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const idleTechs = useMemo(
    () => technicians.filter((t) => t.status === "idle"),
    [technicians]
  );
  const cleanRooms = useMemo(
    () => rooms.filter((r) => r.status === "clean"),
    [rooms]
  );

  const submit = async () => {
    if (!technicianId) return setError("请选择技师");
    if (!roomId) return setError("请选择房间");
    if (!serviceId) return setError("请选择项目");
    setSubmitting(true);
    try {
      await api.startSession({
        technicianId,
        roomId,
        serviceId,
        customerName: customerName.trim() || undefined,
        queueId: presetQueueId,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "开单失败");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>开单上钟</h2>
        {presetCustomer && (
          <div className="modal-banner">来自排队：<b>{presetCustomer}</b>，开单后自动出队</div>
        )}

        <label className="field">
          <span>顾客称呼</span>
          <input
            value={customerName}
            placeholder="如：王先生（留空记为散客）"
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </label>

        <label className="field">
          <span>技师（仅空闲可选，{idleTechs.length} 位空闲）</span>
          <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
            <option value="">请选择技师</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id} disabled={t.status !== "idle"}>
                {t.name}
                {t.status !== "idle" ? `（${t.status === "busy" ? "上钟中" : t.status === "resting" ? "休息中" : "打扫中"}）` : " · 空闲"}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>房间（仅已打扫可选，{cleanRooms.length} 间可用）</span>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">请选择房间</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id} disabled={r.status !== "clean"}>
                {r.name}
                {r.status !== "clean" ? `（${r.status === "occupied" ? "上钟中" : r.status === "dirty" ? "待打扫" : "打扫中"}）` : " · 已打扫"}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>项目</span>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationSec / 60}分钟 · ¥{s.price}
              </option>
            ))}
          </select>
        </label>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || submitting}
            onClick={submit}
          >
            确认开单
          </button>
        </div>
      </div>
    </div>
  );
}
