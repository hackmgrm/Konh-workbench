import type { Task, FocusRecord } from "./types";
import { dayKey, parseDayKey } from "./time";

export interface SunsetStats {
    completedCount: number;
    totalFocusMinutes: number;
    pomodoroCount: number;
    uncompletedTasks: Task[];
}

export function getTodayString(date: Date = new Date()): string {
    return dayKey(date);
}

export function getTomorrowString(date: Date = new Date()): string {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return dayKey(next);
}

/** 汇总今天已经完成的任务、番茄记录，以及截止到今天仍未完成的任务。 */
export function calculateSunsetStats(
    tasks: Task[],
    focus: FocusRecord[],
    today: string = getTodayString()
): SunsetStats {
    const completedCount = tasks.filter(
        (task) => task.done && task.doneAt > 0 && dayKey(new Date(task.doneAt)) === today
    ).length;
    const todayFocus = focus.filter((record) => record.day === today);
    return {
        completedCount,
        totalFocusMinutes: todayFocus.reduce((total, record) => total + (record.minutes || 0), 0),
        pomodoroCount: todayFocus.length,
        uncompletedTasks: tasks.filter((task) => !task.done && !!task.due && task.due <= today)
    };
}

export function shouldPromptSunsetShutdown(
    now: Date = new Date(),
    lastShutdownDate: string | null = null,
    promptHour = 18
): boolean {
    return now.getHours() >= promptHour && lastShutdownDate !== getTodayString(now);
}

export function isValidDayKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = parseDayKey(value);
    return dayKey(parsed) === value;
}
