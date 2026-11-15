<script lang="ts">
    import { toggleTask } from "../lib/taskCompletion";
    import { tasks, save } from "../lib/store";
    import { dayKey, fmtTime } from "../lib/time";
    import type { Task } from "../lib/types";

    let query = "";

    $: done = $tasks
        .filter((t) => t.done && t.doneAt)
        .filter((t) => !query.trim() || t.title.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => b.doneAt - a.doneAt);

    $: groups = (() => {
        const map: Record<string, Task[]> = {};
        done.forEach((t) => {
            const k = dayKey(new Date(t.doneAt));
            (map[k] ||= []).push(t);
        });
        return Object.keys(map)
            .sort()
            .reverse()
            .map((k) => ({ key: k, items: map[k] }));
    })();

    function restore(t: Task) {
        tasks.update((l) => toggleTask(l, t.id, Date.now()));
        save("tasks");
    }

    function dayLabel(k: string): string {
        const today = dayKey();
        const y = new Date();
        y.setDate(y.getDate() - 1);
        if (k === today) return "今天";
        if (k === dayKey(y)) return "昨天";
        return k;
    }
</script>

<div class="page-head">
    <div>
        <div class="page-title">历史归档</div>
        <div class="page-sub">已经完成的事情，都算数。</div>
    </div>
    <div class="count-pill">{done.length} 项已完成</div>
</div>

<div class="ty-row" style="margin-bottom:6px">
    <input class="ty-input" placeholder="搜索已完成的任务…" bind:value={query} />
</div>

{#if groups.length === 0}
    <div class="ty-card">
        <div class="ty-empty">还没有完成的任务</div>
    </div>
{:else}
    {#each groups as g (g.key)}
        <div class="group">
            <div class="group-head">
                <span class="group-title">{dayLabel(g.key)}</span>
                <span class="group-count">{g.items.length} 项</span>
            </div>
            <div class="ty-card flush">
                {#each g.items as t (t.id)}
                    <div class="row">
                        <button class="done-mark" on:click={() => restore(t)} title="撤销完成">✓</button>
                        <span class="title">{t.title}</span>
                        <span class="time">{fmtTime(t.doneAt)}</span>
                        <button class="undo" on:click={() => restore(t)}>恢复</button>
                    </div>
                {/each}
            </div>
        </div>
    {/each}
{/if}

<style>
    .count-pill {
        font-size: 11.5px;
        color: #4d7c5d;
        background: #e6efe7;
        padding: 6px 14px;
        border-radius: 20px;
        white-space: nowrap;
    }
    .group {
        margin-bottom: 16px;
    }
    .group-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 0 4px 8px;
    }
    .group-title {
        font-size: 12.5px;
        font-weight: 700;
        color: #2f3a32;
    }
    .group-count {
        font-size: 10.5px;
        color: #9aa398;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 16px;
        border-bottom: 1px solid #f4f1ea;
    }
    .row:last-child {
        border-bottom: 0;
    }
    .row:hover {
        background: #f8f6f0;
    }
    .done-mark {
        width: 17px;
        height: 17px;
        border-radius: 50%;
        border: 0;
        background: #4d7c5d;
        color: #fff;
        font-size: 10px;
        line-height: 1;
        cursor: pointer;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.85;
    }
    .done-mark:hover {
        opacity: 1;
    }
    .title {
        flex: 1;
        min-width: 0;
        font-size: 12.5px;
        color: #6b7568;
        text-decoration: line-through;
        word-break: break-word;
    }
    .time {
        font-size: 10.5px;
        color: #b9b2a2;
        flex: 0 0 auto;
    }
    .undo {
        border: 0;
        background: transparent;
        color: #9aa398;
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        opacity: 0;
        flex: 0 0 auto;
    }
    .row:hover .undo {
        opacity: 1;
    }
    .undo:hover {
        color: #4d7c5d;
    }
</style>
