// 技师状态：绿 空闲 / 红 上钟 / 黄 待打扫房间中 / 灰 休息吃饭
export type TechStatus = "idle" | "busy" | "cleaning" | "resting";

// 房间状态：已打扫(可用) / 待打扫 / 打扫中 / 上钟中
export type RoomStatus = "clean" | "dirty" | "cleaning" | "occupied";

export interface Technician {
  id: string;
  name: string;
  status: TechStatus;
  roomId: string | null;
}

export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
  sessionId: string | null;
  technicianId: string | null;
  dirtyAt: number | null;
}

export interface ServiceItem {
  id: string;
  name: string;
  durationSec: number;
  price: number;
}

export interface Session {
  id: string;
  technicianId: string;
  roomId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  durationSec: number;
  customerName: string;
  startedAt: number;
  finishedAt?: number;
}

export interface QueueEntry {
  id: string;
  name: string;
  joinedAt: number;
}

export interface Stats {
  idle: number;
  busy: number;
  cleaning: number;
  resting: number;
  served: number;
  revenue: number;
  queueCount: number;
}

export interface Snapshot {
  serverTime: number;
  demo: boolean;
  technicians: Technician[];
  rooms: Room[];
  services: ServiceItem[];
  sessions: Session[];
  queue: QueueEntry[];
  stats: Stats;
}

export const TECH_STATUS_META: Record<TechStatus, { label: string; cls: string }> = {
  idle: { label: "空闲", cls: "green" },
  busy: { label: "上钟中", cls: "red" },
  cleaning: { label: "待打扫房间中", cls: "yellow" },
  resting: { label: "休息/吃饭", cls: "gray" },
};

export const ROOM_STATUS_META: Record<RoomStatus, { label: string; cls: string }> = {
  clean: { label: "已打扫", cls: "green" },
  dirty: { label: "待打扫", cls: "yellow" },
  cleaning: { label: "打扫中", cls: "blue" },
  occupied: { label: "上钟中", cls: "red" },
};

export const QUEUE_ALERT_MS = 20 * 60 * 1000;
