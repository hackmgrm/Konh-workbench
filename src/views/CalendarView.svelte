<script lang="ts">
    import { toggleTask } from "../lib/taskCompletion";
    import { tasks, diaries, focusRecords, save } from "../lib/store";
    import { dayKey, parseDayKey } from "../lib/time";
    import type { Task } from "../lib/types";

    let cursor = new Date();
    let selected = dayKey();

    $: year = cursor.getFullYear();
    $: month = cursor.getMonth();
    $: monthLabel = `${year} 年 ${month + 1} 月`;
    $: todayKey = dayKey();

    $: cells = (() => {
        const first = new Date(year, month, 1);
        const pad = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevDays = new Date(year, month, 0).getDate();
        const out: { n: number; key: string; other: boolean }[] = [];
        for (let i = pad - 1; i >= 0; i--) {
            const n = prevDays - i;
            out.push({ n, key: dayKey(new Date(year, month - 1, n)), other: true });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            out.push({ n: d, key: dayKey(new Date(year, month, d)), other: false });
        }
        let extra = 1;
        while (out.length % 7 !== 0) {
            out.push({ n: extra, key: dayKey(new Date(year, month + 1, extra)), other: true });
            extra++;
        }
        return out;
    })();

    function taskDay(t: Task): string {
        if (t.due) return t.due;
        if (t.start) return t.start;
        if (t.done && t.doneAt) return dayKey(new Date(t.doneAt));
        return dayKey(new Date(t.created || Date.now()));
    }

    function isOnDay(t: Task, key: string): boolean {
        if (t.start && t.due) return t.start <= key && key <= t.due;
        return taskDay(t) === key;
    }

    function marks(key: string) {
        const count = $tasks.filter((t) => isOnDay(t, key)).length;
        const hasDiary = !!(($diaries[key]?.content) || "").trim();
        const pomo = $focusRecords.filter((f) => f.day === key).length;
        return { count, hasDiary, pomo };
    }

    function shift(delta: number) {
        cursor = new Date(year, month + delta, 1);
    }

    $: selTasks = $tasks.filter((t) => isOnDay(t, selected));

    function toggle(t: Task) {
        tasks.update((l) => toggleTask(l, t.id));
        save("tasks");
    }
</script>

<div class="ty-cal-nav">
    <button class="ty-btn ghost sm" on:click={() => shift(-1)}>‹</button>
    <span class="ty-cal-month">{monthLabel}</span>
    <button class="ty-btn ghost sm" on:click={() => shift(1)}>›</button>
</div>

<div class="ty-cal">
    {#each "日一二三四五六".split("") as w}
        <div class="ty-cal-w">{w}</div>
    {/each}

    {#each cells as c (c.key + c.other)}
        <div
            class="ty-cal-d"
            class:other={c.other}
            class:today={c.key === todayKey}
            class:sel={c.key === selected}
            on:click={() => (selected = c.key)}
            on:keydown={() => {}}
            role="button"
            tabindex="0"
        >
            <span>{c.n}</span>
            <div class="ty-cal-dots">
                {#if marks(c.key).count > 0}
                    <i class="ty-cal-dot"></i>
                {/if}
                {#if marks(c.key).hasDiary}
                    <i class="ty-cal-dot diary"></i>
                {/if}
            </div>
        </div>
    {/each}
</div>

<div style="margin-top:18px">
    <div class="ty-h2">
        {selected}
        {#if marks(selected).pomo > 0}
            <span class="ty-dim">{marks(selected).pomo} 个番茄</span>
        {/if}
    </div>

    {#if selTasks.length === 0}
        <div class="ty-empty">这天没有任务</div>
    {:else}
        {#each selTasks as t (t.id)}
            <div class="ty-task" class:done={t.done}>
                <button class="ty-check" class:checked={t.done} on:click={() => toggle(t)} aria-label="完成"></button>
                <div class="ty-task-title">{t.title}</div>
            </div>
        {/each}
    {/if}

    {#if (($diaries[selected]?.content) || "").trim()}
        <div class="ty-card" style="margin-top:10px">
            <div class="ty-h2">日记</div>
            <div class="ty-dim" style="white-space:pre-wrap;line-height:1.7">{$diaries[selected].content.slice(0, 200)}</div>
        </div>
    {/if}
</div>
