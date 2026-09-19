import { ROOM_STATUS_META, TECH_STATUS_META } from "../types";
import type { RoomStatus, TechStatus } from "../types";

export function TechStatusBadge({ status }: { status: TechStatus }) {
  const meta = TECH_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROOM_STATUS_META[status].badge}`}
    >
      {ROOM_STATUS_META[status].label}
    </span>
  );
}
