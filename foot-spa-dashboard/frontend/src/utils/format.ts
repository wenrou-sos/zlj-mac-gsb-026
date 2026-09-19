// 展示用格式化工具

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 时钟：14:08:32 */
export function fmtClock(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 日期：2026年9月19日 星期五 */
export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${week[d.getDay()]}`;
}

/** 已做时长：12分05秒；超过 1 小时显示 1时05分 */
export function fmtElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}时${pad2(m)}分`;
  return `${m}分${pad2(s)}秒`;
}

/** 剩余时长（分钟粒度，更适合前台快速看）：25分钟 / 已超时3分钟 */
export function fmtRemaining(ms: number): string {
  if (ms < 0) return `已超时${Math.ceil(-ms / 60000)}分钟`;
  return `约${Math.ceil(ms / 60000)}分钟`;
}

/** 排队等待时长 */
export function fmtWait(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}分${pad2(sec)}秒`;
}

export function yuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN")}`;
}

export function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]));
}
