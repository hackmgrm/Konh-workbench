import type { Task } from "./types";
import { dayKey, parseDayKey } from "./time";

function successor(task: Task, now: number): Task | null {
    if (!["daily", "weekday", "weekly", "monthly"].includes(task.repeat)) return null;
    const base = task.due || dayKey(new Date(now));
    const date = parseDayKey(base);
    if (dayKey(date) !== base) return null;
    if (task.repeat === "monthly") {
        const day = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);
        date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    } else {
        date.setDate(date.getDate() + (task.repeat === "weekly" ? 7 : 1));
        if (task.repeat === "weekday") {
            while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
        }
    }
    const due = dayKey(date);
    // Shift the start by the same calendar-day interval as the due date.
    let start = task.start;
    if (start && task.due) {
        const original = parseDayKey(task.due);
        const s = parseDayKey(start);
        if (dayKey(s) === start) {
            const days = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(original.getFullYear(), original.getMonth(), original.getDate())) / 86400000);
            s.setDate(s.getDate() + days);
            start = dayKey(s);
        }
    }
    return { ...task, id: `${task.id}::repeat`, created: now, done: false, doneAt: 0, due, start,
        subtasks: task.subtasks.map((s) => ({ ...s, done: false })), tags: [...task.tags] };
}

/** Toggle from the current store state, avoiding duplicate successors on stale UI events. */
export function toggleTask(list: Task[], id: string, now = Date.now(), completeOnly = false): Task[] {
    const task = list.find((t) => t.id === id);
    if (!task || (completeOnly && task.done)) return list;
    if (task.done) {
        const expected = successor(task, task.doneAt);
        return list.filter((t) => !expected || t.id !== expected.id || JSON.stringify(t) !== JSON.stringify(expected))
            .map((t) => t.id === id ? { ...t, done: false, doneAt: 0 } : t);
    }
    const next = successor(task, now);
    const completed = list.map((t) => t.id === id ? { ...t, done: true, doneAt: now } : t);
    return next && !list.some((t) => t.id === next.id) ? [next, ...completed] : completed;
}
