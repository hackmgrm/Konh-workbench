<script lang="ts">
    import { toggleTask } from "../lib/taskCompletion";
    import { tasks, save } from "../lib/store";
    import { timerState, pomodoro, attachCurrentTask } from "../lib/timer";
    import { fmtClock } from "../lib/time";
    import type { Task } from "../lib/types";

    export let onExit: () => void;

    $: open = $tasks.filter((t) => !t.done);
    $: s = $timerState;
    $: pct = s.total > 0 ? (s.total - s.left) / s.total : 0;
    $: R = 120;
    $: C = 2 * Math.PI * R;
    $: dash = C * Math.min(1, Math.max(0, pct));

    let index = 0;
    $: current = open.length ? open[Math.min(index, open.length - 1)] : null;

    $: if (current && s.taskId !== current.id) {
        attachCurrentTask(current.id);
    }

    function completeAndNext() {
        if (!current) return;
        tasks.update((l) => toggleTask(l, current!.id, Date.now(), true));
        save("tasks");
        attachCurrentTask("");
    }

    function next() {
        if (open.length === 0) return;
        index = (index + 1) % open.length;
    }
</script>

<div class="flow">
    <div class="flow-top">
        <button class="exit" on:click={onExit}>‹ 退出心流</button>
        <span class="counter">{open.length ? `${Math.min(index + 1, open.length)} / ${open.length}` : "0 / 0"}</span>
    </div>

    {#if !current}
        <div class="empty-flow">
            <div class="empty-emoji">🌿</div>
            <div>没有待办任务了</div>
            <button class="ty-btn" on:click={onExit} style="margin-top:14px">返回</button>
        </div>
    {:else}
        <div class="ring-wrap">
            <svg width="280" height="280" viewBox="0 0 280 280">
                <defs>
                    <linearGradient id="flowRing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#e7b6c9" />
                        <stop offset="55%" stop-color="#c9a6d6" />
                        <stop offset="100%" stop-color="#a9b6e0" />
                    </linearGradient>
                </defs>
                <circle cx="140" cy="140" r={R} fill="none" stroke="#f0ece3" stroke-width="12" />
                <circle
                    cx="140"
                    cy="140"
                    r={R}
                    fill="none"
                    stroke="url(#flowRing)"
                    stroke-width="12"
                    stroke-linecap="round"
                    stroke-dasharray="{dash} {C}"
                    style="transition: stroke-dasharray .45s ease"
                />
            </svg>
            <div class="ring-center">
                <div class="clock">{fmtClock(s.left)}</div>
                <div class="mode">{s.mode === "focus" ? "只做这一件" : "休息一下"}</div>
            </div>
        </div>

        <div class="task-block">
            <div class="task-title">{current.title}</div>
            {#if current.note}
                <div class="task-note">{current.note}</div>
            {/if}
        </div>

        <div class="actions">
            <button class="act" on:click={() => pomodoro.toggle()}>
                {s.running ? "暂停" : "开始专注"}
            </button>
            <button class="act primary" on:click={completeAndNext}>完成，下一个</button>
            <button class="act ghost" on:click={next}>跳过</button>
        </div>
    {/if}
</div>

<style>
    .flow {
        position: fixed;
        inset: 0;
        z-index: 9995;
        background: linear-gradient(170deg, #fbfaf6, #f6f2e9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 32px;
    }
    .flow-top {
        position: absolute;
        top: 22px;
        left: 24px;
        right: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .exit {
        border: 0;
        background: transparent;
        color: #6b7568;
        font-family: inherit;
        font-size: 12.5px;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 10px;
    }
    .exit:hover {
        background: #ece8df;
    }
    .counter {
        font-size: 11.5px;
        color: #9aa398;
        letter-spacing: 1px;
    }
    .ring-wrap {
        position: relative;
    }
    .ring-wrap svg {
        transform: rotate(-90deg);
        display: block;
    }
    .ring-center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    .clock {
        font-size: 46px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 1px;
        color: #2f3a32;
        line-height: 1;
    }
    .mode {
        font-size: 11px;
        color: #9aa398;
        letter-spacing: 3px;
    }
    .task-block {
        text-align: center;
        margin-top: 22px;
        max-width: 560px;
    }
    .task-title {
        font-size: 21px;
        font-weight: 700;
        color: #2f3a32;
        line-height: 1.45;
        word-break: break-word;
    }
    .task-note {
        margin-top: 10px;
        font-size: 12.5px;
        color: #9aa398;
        line-height: 1.7;
        white-space: pre-wrap;
    }
    .actions {
        display: flex;
        gap: 10px;
        margin-top: 30px;
    }
    .act {
        padding: 10px 22px;
        border-radius: 24px;
        border: 1px solid #ece8df;
        background: #fff;
        color: #2f3a32;
        font-family: inherit;
        font-size: 12.5px;
        cursor: pointer;
        transition: all 0.16s;
    }
    .act:hover {
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .act.primary {
        background: #4d7c5d;
        border-color: #4d7c5d;
        color: #fff;
        font-weight: 600;
    }
    .act.primary:hover {
        background: #436b51;
        color: #fff;
    }
    .act.ghost {
        border-color: transparent;
        background: transparent;
        color: #9aa398;
    }
    .empty-flow {
        display: flex;
        flex-direction: column;
        align-items: center;
        color: #9aa398;
        font-size: 13px;
    }
    .empty-emoji {
        font-size: 40px;
        margin-bottom: 10px;
    }
</style>
