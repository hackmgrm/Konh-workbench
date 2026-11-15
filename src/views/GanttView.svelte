<script lang="ts">
    import { toggleTask } from "../lib/taskCompletion";
    import { tasks, categories, save } from "../lib/store";
    import { dayKey, parseDayKey } from "../lib/time";
    import type { Task } from "../lib/types";

    const DAYS = 28;
    const COL = 30;

    $: catMap = Object.fromEntries($categories.map((c) => [c.id, c]));

    $: startDate = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    })();

    $: cols = Array.from({ length: DAYS }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return { key: dayKey(d), day: d.getDate(), month: d.getMonth() + 1, weekend: d.getDay() === 0 || d.getDay() === 6 };
    });

    function offset(k: string): number {
        const t = parseDayKey(k).getTime();
        return Math.round((t - startDate.getTime()) / 86400000);
    }

    $: rows = (() => {
        const list = $tasks.filter((t) => !t.done && (t.start || t.due));
        return list
            .map((t) => {
                let s = t.start || t.due;
                let e = t.due || t.start;
                if (s > e) { const tmp = s; s = e; e = tmp; }
                return { task: t, s, e, si: offset(s), ei: offset(e) };
            })
            .filter((r) => r.ei >= 0 && r.si < DAYS)
            .sort((a, b) => a.si - b.si);
    })();

    function bar(t: Task) {
        const c = catMap[t.category];
        return c ? c.color : "#4d7c5d";
    }

    function clamp(n: number): number {
        return Math.max(0, Math.min(DAYS - 1, n));
    }

    function toggle(t: Task) {
        tasks.update((l) => toggleTask(l, t.id));
        save("tasks");
    }

    $: todayIdx = offset(dayKey());
</script>

<div class="page-head">
    <div>
        <div class="page-title">甘特图</div>
        <div class="page-sub">未来 {DAYS} 天的时间分布，给任务一个看得见的位置。</div>
    </div>
    <div class="count-pill">{rows.length} 个排期任务</div>
</div>

{#if rows.length === 0}
    <div class="ty-card">
        <div class="ty-empty">
            还没有带日期的任务。<br />
            去「待办清单」给任务加上开始或截止日期，这里就会出现时间条。
        </div>
    </div>
{:else}
    <div class="gantt card">
        <div class="g-head">
            <div class="g-name-col">任务</div>
            <div class="g-timeline">
                {#each cols as c, i (c.key)}
                    <div class="g-col" class:weekend={c.weekend} class:today={i === todayIdx}>
                        <span class="g-m">{i === 0 || c.day === 1 ? c.month + "月" : ""}</span>
                        <span class="g-d">{c.day}</span>
                    </div>
                {/each}
            </div>
        </div>

        {#each rows as r (r.task.id)}
            <div class="g-row">
                <div class="g-name-col">
                    <button class="g-check" on:click={() => toggle(r.task)} aria-label="完成"></button>
                    <span class="g-title" title={r.task.title}>{r.task.title}</span>
                </div>
                <div class="g-timeline">
                    {#each cols as c, i (c.key)}
                        <div class="g-cell" class:weekend={c.weekend} class:today={i === todayIdx}></div>
                    {/each}
                    <div
                        class="g-bar"
                        style="left:{clamp(r.si) * COL + 2}px;width:{Math.max(COL - 4, (clamp(r.ei) - clamp(r.si) + 1) * COL - 4)}px;background:{bar(r.task)}"
                        title={`${r.s} → ${r.e}`}
                    >
                        {#if r.ei - r.si >= 1}
                            <span>{r.task.title}</span>
                        {/if}
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}

<div class="legend">
    {#each $categories as c (c.id)}
        <span class="lg"><i style="background:{c.color}"></i>{c.name}</span>
    {/each}
</div>

<style>
    .count-pill {
        font-size: 11.5px;
        color: #4d7c5d;
        background: #e6efe7;
        padding: 6px 14px;
        border-radius: 20px;
        white-space: nowrap;
    }
    .gantt {
        background: #fff;
        border-radius: 18px;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
        overflow-x: auto;
        padding: 0;
    }
    .g-head,
    .g-row {
        display: flex;
        align-items: stretch;
        min-width: fit-content;
    }
    .g-head {
        border-bottom: 1px solid #f0ece3;
        position: sticky;
        top: 0;
        background: #fff;
        z-index: 2;
    }
    .g-row {
        border-bottom: 1px solid #f8f6f0;
    }
    .g-row:last-child {
        border-bottom: 0;
    }
    .g-row:hover {
        background: #fdfcf9;
    }
    .g-name-col {
        flex: 0 0 168px;
        width: 168px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11.5px;
        color: #6b7568;
        position: sticky;
        left: 0;
        background: inherit;
        z-index: 1;
    }
    .g-head .g-name-col {
        background: #fff;
        font-weight: 600;
        color: #2f3a32;
        z-index: 3;
    }
    .g-check {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1.5px solid #cfdfd2;
        background: transparent;
        cursor: pointer;
        flex: 0 0 auto;
        padding: 0;
    }
    .g-check:hover {
        background: #e6efe7;
    }
    .g-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .g-timeline {
        position: relative;
        display: flex;
        flex: 0 0 auto;
    }
    .g-col {
        width: 30px;
        flex: 0 0 30px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 5px 0 4px;
        border-left: 1px solid #f8f6f0;
    }
    .g-col.weekend {
        background: #faf8f4;
    }
    .g-col.today {
        background: #e6efe7;
    }
    .g-m {
        font-size: 8.5px;
        color: #b9b2a2;
        height: 10px;
    }
    .g-d {
        font-size: 10.5px;
        color: #6b7568;
    }
    .g-col.today .g-d {
        color: #4d7c5d;
        font-weight: 700;
    }
    .g-cell {
        width: 30px;
        flex: 0 0 30px;
        border-left: 1px solid #f8f6f0;
    }
    .g-cell.weekend {
        background: #faf8f4;
    }
    .g-cell.today {
        background: #f2f7f2;
    }
    .g-bar {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        height: 20px;
        border-radius: 6px;
        opacity: 0.9;
        display: flex;
        align-items: center;
        padding: 0 8px;
        overflow: hidden;
        cursor: default;
        transition: opacity 0.15s;
    }
    .g-bar:hover {
        opacity: 1;
    }
    .g-bar span {
        font-size: 10px;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .legend {
        display: flex;
        gap: 14px;
        padding: 4px 6px;
        flex-wrap: wrap;
    }
    .lg {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 10.5px;
        color: #9aa398;
    }
    .lg i {
        width: 8px;
        height: 8px;
        border-radius: 3px;
        display: inline-block;
    }
</style>
