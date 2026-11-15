import { tasks } from "./store";
import type { Task } from "./types";

const STORAGE_KEY = "tongyun.task-reminders.v1";
const CHECK_INTERVAL = 30_000;
// 补发最近 24 小时错过的提醒，避免重启后涌出很久以前的任务。
const CATCH_UP = 24 * 60 * 60 * 1000;

/** 截止日期按本地时间 09:00 计算；无效日期或未启用提醒返回 null。 */
export function reminderTime(task: Task): number | null {
    if (task.done || !Number.isFinite(task.reminder) || task.reminder <= 0) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.due || "");
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(year, month - 1, day, 9, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date.getTime() - task.reminder * 60_000;
}

/**
 * 在任务数据 hydrate 后调用一次，传入思源 showMessage；卸载时调用返回的函数。
 * 同一任务、截止日期和提前量只提示一次；重复任务更新截止日期后会再次提示。
 * 使用本地存储去重；存储不可用时只保证当前实例内去重。
 */
export function startReminders(showMessage: (message: string) => unknown): () => void {
    let delivered: Record<string, number> = {};
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (raw && typeof raw === "object" && !Array.isArray(raw)) delivered = raw;
    } catch { /* 无存储权限时使用内存 */ }
    let current: Task[] = [];
    let stopped = false;

    function check(): void {
        if (stopped) return;
        const now = Date.now();
        let changed = false;
        for (const key of Object.keys(delivered)) {
            if (typeof delivered[key] !== "number" || delivered[key] < now - CATCH_UP * 2) {
                delete delivered[key];
                changed = true;
            }
        }
        for (const task of current) {
            const at = reminderTime(task);
            if (at === null || at > now || at < now - CATCH_UP) continue;
            const key = JSON.stringify([task.id, task.due, task.reminder]);
            if (Object.prototype.hasOwnProperty.call(delivered, key)) continue;
            try {
                showMessage(`任务提醒：${task.title || "未命名任务"}（截止 ${task.due} 09:00）`);
                delivered[key] = now;
                changed = true;
            } catch (error) {
                console.error("[tongyun] reminder failed", error);
            }
        }
        if (changed) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(delivered)); } catch { /* 内存去重 */ }
        }
    }

    const unsubscribe = tasks.subscribe((value) => { current = value; check(); });
    const timer = setInterval(check, CHECK_INTERVAL);
    return () => { stopped = true; clearInterval(timer); unsubscribe(); };
}
