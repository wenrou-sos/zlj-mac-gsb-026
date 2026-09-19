export type TechStatus = "idle" | "serving" | "room_cleaning" | "resting";
export type RoomStatus = "cleaned" | "dirty" | "cleaning";

export interface ServiceItem {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  category: string;
}

export interface Technician {
  id: string;
  name: string;
  level: string;
  status: TechStatus;
  currentRoomId: string | null;
}

export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
}

export interface SessionRow {
  id: string;
  techId: string;
  techName: string;
  roomId: string;
  roomName: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  startedAt: number;
  endAt: number;
  elapsedSec: number;
  remainingSec: number;
  overdueSec: number;
  durationMin: number;
  price: number;
  overdue: boolean;
}

export interface QueueCustomer {
  id: string;
  name: string;
  phone: string;
  partySize: number;
  preferred: string;
  arrivedAt: number;
  waitSec: number;
  overtime: boolean;
  acknowledged: boolean;
}

export interface Metrics {
  idleTechs: number;
  servingTechs: number;
  servedToday: number;
  revenueToday: number;
  availableRooms: number;
  waitingCustomers: number;
}

export interface SpaState {
  now: number;
  services: ServiceItem[];
  technicians: Technician[];
  rooms: Room[];
  sessions: SessionRow[];
  queue: QueueCustomer[];
  metrics: Metrics;
}

export const TECH_STATUS_META: Record<
  TechStatus,
  { label: string; dot: string; badge: string; cell: string }
> = {
  idle: {
    label: "空闲",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
    cell: "text-emerald-400",
  },
  serving: {
    label: "上钟",
    dot: "bg-red-400",
    badge: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
    cell: "text-red-400",
  },
  room_cleaning: {
    label: "待打扫房间中",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40",
    cell: "text-amber-400",
  },
  resting: {
    label: "休息/吃饭",
    dot: "bg-slate-400",
    badge: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/40",
    cell: "text-slate-400",
  },
};

export const ROOM_STATUS_META: Record<
  RoomStatus,
  { label: string; badge: string; bar: string }
> = {
  cleaned: {
    label: "已打扫（可用）",
    badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
    bar: "from-emerald-500 to-teal-400",
  },
  dirty: {
    label: "待打扫",
    badge: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/40",
    bar: "from-orange-500 to-amber-400",
  },
  cleaning: {
    label: "打扫中",
    badge: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40",
    bar: "from-sky-500 to-cyan-400",
  },
};
