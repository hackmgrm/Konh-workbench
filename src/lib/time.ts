export function pad2(n: number): string {
    return n < 10 ? "0" + n : String(n);
}

export function dayKey(d?: Date): string {
    const t = d || new Date();
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

export function parseDayKey(key: string): Date {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
}

export function fmtClock(totalSec: number): string {
    const s = Math.max(0, Math.floor(totalSec));
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

export function fmtTime(ts: number): string {
    const d = new Date(ts);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtDateCN(d: Date): string {
    const w = "日一二三四五六".charAt(d.getDay());
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${w}`;
}

/** 按重复规则推算下一次截止日期 */
export function nextDue(due: string, rule: string): string {
    const base = due ? parseDayKey(due) : new Date();
    const d = new Date(base);

    if (rule === "daily") {
        d.setDate(d.getDate() + 1);
    } else if (rule === "weekday") {
        do {
            d.setDate(d.getDate() + 1);
        } while (d.getDay() === 0 || d.getDay() === 6);
    } else if (rule === "weekly") {
        d.setDate(d.getDate() + 7);
    } else if (rule === "monthly") {
        d.setMonth(d.getMonth() + 1);
    }
    return dayKey(d);
}

/** 距离今天还有几天，负数表示已过期 */
export function daysUntil(due: string): number {
    if (!due) return 9999;
    const target = parseDayKey(due).getTime();
    const today = parseDayKey(dayKey()).getTime();
    return Math.round((target - today) / 86400000);
}

export function greeting(): string {
    const h = new Date().getHours();
    if (h < 5) return "夜深了";
    if (h < 9) return "早上好";
    if (h < 12) return "上午好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    if (h < 23) return "晚上好";
    return "夜深了";
}
