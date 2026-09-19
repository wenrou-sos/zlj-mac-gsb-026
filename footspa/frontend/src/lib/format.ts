/** 秒数 -> "1时05分" / "42分" / "12秒" 等展示 */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}时${String(m).padStart(2, "0")}分`;
  if (m > 0) return `${m}分${String(sec).padStart(2, "0")}秒`;
  return `${sec}秒`;
}

export function formatClock(ts: number): string {
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function formatNow(): string {
  return formatClock(Date.now() / 1000);
}

export function yuan(v: number): string {
  return `¥${v.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
