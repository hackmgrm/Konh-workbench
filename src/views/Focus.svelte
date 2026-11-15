<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { timerState, pomodoro, attachCurrentTask } from "../lib/timer";
    import { settings, save, focusRecords, tasks } from "../lib/store";
    import { NOISE_LABELS, type NoiseEngine, type NoiseType } from "../lib/noise";
    import { fmtClock, dayKey } from "../lib/time";

    export let noise: NoiseEngine;

    const dispatch = createEventDispatcher<{ goto: "tasks" }>();

    $: s = $timerState;
    $: running = s.running;
    $: isBreak = s.mode !== "focus";
    $: pct = s.total > 0 ? (s.total - s.left) / s.total : 0;
    $: R = 88;
    $: C = 2 * Math.PI * R;
    $: dash = C * Math.min(1, Math.max(0, pct));

    $: today = dayKey();
    $: todays = $focusRecords.filter((f) => f.day === today);
    $: pomos = todays.length;
    $: minutes = todays.reduce((a, b) => a + b.minutes, 0);
    $: goal = $settings.dailyGoal || 6;
    $: goalPct = Math.min(100, Math.round((pomos / goal) * 100));

    $: currentTask = s.taskId ? $tasks.find((t) => t.id === s.taskId) : null;
    $: openTasks = $tasks.filter((t) => !t.done).slice(0, 12);

    $: week = (() => {
        const out: { label: string; count: number }[] = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const k = dayKey(d);
            out.push({
                label: `${d.getMonth() + 1}/${d.getDate()}`,
                count: $focusRecords.filter((f) => f.day === k).length
            });
        }
        return out;
    })();
    $: weekMax = Math.max(1, ...week.map((w) => w.count));

    let activeNoise: NoiseType | null = null;

    function toggleNoise(key: NoiseType) {
        if (noise.playing && noise.type === key) {
            noise.fadeOut();
            activeNoise = null;
        } else {
            noise.play(key, $settings.noiseVolume);
            activeNoise = key;
        }
    }

    function onVolume(e: Event) {
        const v = Number((e.target as HTMLInputElement).value);
        settings.update((x) => ({ ...x, noiseVolume: v }));
        noise.setVolume(v);
        save("settings");
    }

    function pickTask(id: string) {
        attachCurrentTask(id === s.taskId ? "" : id);
    }

    function bump(delta: number) {
        if (running) return;
        timerState.update((st) => {
            const left = Math.max(60, Math.min(st.total, st.left + delta * 60));
            return { ...st, left, total: Math.max(st.total, left) };
        });
    }
</script>

<div class="page-head">
    <div>
        <div class="page-title">专注模式</div>
        <div class="page-sub">一次只做一件事，剩下的交给番茄钟。</div>
    </div>
    <div class="pill-mode">{s.mode === "focus" ? "专注中" : s.mode === "longBreak" ? "长休息" : "短休息"}</div>
</div>

<div class="focus-wrap">
    <div class="ring-box">
        <svg width="212" height="212" viewBox="0 0 212 212">
            <defs>
                <linearGradient id="tyRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#e7b6c9" />
                    <stop offset="55%" stop-color="#c9a6d6" />
                    <stop offset="100%" stop-color="#a9b6e0" />
                </linearGradient>
            </defs>
            <circle cx="106" cy="106" r={R} fill="none" stroke="#f0ece3" stroke-width="10" />
            <circle
                cx="106"
                cy="106"
                r={R}
                fill="none"
                stroke="url(#tyRing)"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray="{dash} {C}"
                style="transition: stroke-dasharray .45s ease"
            />
        </svg>
        <div class="ring-center">
            <div class="clock" class:break={isBreak}>{fmtClock(s.left)}</div>
            <div class="round">第 {s.round + 1} 个番茄</div>
        </div>
    </div>

    <div class="ctrl-row">
        <button class="round-btn" on:click={() => bump(-5)} title="减 5 分钟">−</button>
        <button class="play-btn" on:click={() => pomodoro.toggle()} title={running ? "暂停" : "开始"}>
            {running ? "❚❚" : "▶"}
        </button>
        <button class="round-btn" on:click={() => pomodoro.reset()} title="重置">↻</button>
        <button class="round-btn" on:click={() => bump(5)} title="加 5 分钟">+</button>
    </div>

    <div class="pill-row">
        <span class="pill">今日专注：<b>{pomos}</b> 个</span>
        <span class="pill"><b>{minutes}</b> 分钟</span>
    </div>

    {#if currentTask}
        <div class="cur-task">当前任务 · {currentTask.title}</div>
    {/if}
</div>

<div class="ty-card">
    <div class="ty-h2">
        白噪音
        {#if activeNoise}
            <button class="ty-btn ghost sm" on:click={() => { noise.fadeOut(); activeNoise = null; }}>停止</button>
        {/if}
    </div>
    <div class="noise-chips">
        {#each NOISE_LABELS as n (n.key)}
            <button class="chip" class:active={activeNoise === n.key} on:click={() => toggleNoise(n.key)}>
                {n.label}
            </button>
        {/each}
    </div>
    <div class="ty-row" style="margin-top:12px">
        <span class="ty-dim">音量</span>
        <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={$settings.noiseVolume}
            on:input={onVolume}
            class="vol"
        />
    </div>
</div>

<div class="two">
    <div class="ty-card">
        <div class="ty-h2">
            关联任务
            <button class="ty-btn ghost sm" on:click={() => dispatch("goto", "tasks")}>管理</button>
        </div>
        {#if openTasks.length === 0}
            <div class="ty-empty">没有未完成的任务</div>
        {:else}
            <div class="task-picks">
                {#each openTasks as t (t.id)}
                    <button
                        class="pick"
                        class:on={s.taskId === t.id}
                        on:click={() => pickTask(t.id)}
                    >
                        <span class="dot"></span>
                        {t.title}
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <div class="ty-card">
        <div class="ty-h2">近 7 天</div>
        <div class="ty-bars">
            {#each week as w}
                <div class="ty-bar-wrap">
                    <div class="ty-bar" style="height:{Math.max(3, (w.count / weekMax) * 52)}px" title={`${w.label} · ${w.count} 个`}></div>
                    <div class="ty-bar-label">{w.label}</div>
                </div>
            {/each}
        </div>
        <div class="ty-row" style="margin-top:12px">
            <div class="ty-progress" style="flex:1">
                <div class="ty-progress-fill" style="width:{goalPct}%"></div>
            </div>
            <span class="ty-dim">{pomos}/{goal}</span>
        </div>
    </div>
</div>

<style>
    .pill-mode {
        font-size: 11.5px;
        color: #4d7c5d;
        background: #e6efe7;
        padding: 6px 14px;
        border-radius: 20px;
        white-space: nowrap;
    }
    .focus-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #fff;
        border-radius: 18px;
        padding: 22px 24px 24px;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
        gap: 4px;
    }
    .ring-box {
        position: relative;
        margin: 4px 0 8px;
    }
    .ring-box svg {
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
        gap: 5px;
    }
    .clock {
        font-size: 37px;
        font-weight: 700;
        letter-spacing: 1px;
        font-variant-numeric: tabular-nums;
        color: #2f3a32;
        line-height: 1;
    }
    .clock.break {
        color: #8badcf;
    }
    .round {
        font-size: 10.5px;
        color: #9aa398;
        letter-spacing: 0.5px;
    }
    .ctrl-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 6px;
    }
    .round-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid #ece8df;
        background: #fff;
        color: #6b7568;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        transition: all 0.15s;
    }
    .round-btn:hover {
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .play-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 0;
        background: #4d7c5d;
        color: #fff;
        cursor: pointer;
        font-size: 15px;
        line-height: 1;
        box-shadow: 0 6px 18px rgba(77, 124, 93, 0.3);
        transition: transform 0.12s, background 0.15s;
    }
    .play-btn:hover {
        background: #436b51;
    }
    .play-btn:active {
        transform: scale(0.95);
    }
    .pill-row {
        display: flex;
        gap: 8px;
        margin-top: 14px;
        flex-wrap: wrap;
        justify-content: center;
    }
    .pill {
        font-size: 11.5px;
        color: #6b7568;
        background: #f5f2ea;
        padding: 6px 13px;
        border-radius: 20px;
    }
    .pill b {
        color: #2f3a32;
        font-weight: 700;
    }
    .cur-task {
        margin-top: 10px;
        font-size: 12px;
        color: #6b7568;
        max-width: 92%;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .noise-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
    }
    .chip {
        padding: 6px 13px;
        border-radius: 20px;
        border: 1px solid #ece8df;
        background: #fff;
        color: #6b7568;
        font-family: inherit;
        font-size: 11.5px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .chip:hover {
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .chip.active {
        background: #4d7c5d;
        border-color: #4d7c5d;
        color: #fff;
    }
    .vol {
        flex: 1;
        accent-color: #4d7c5d;
    }
    .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }
    .task-picks {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .pick {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 10px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #2f3a32;
        font-family: inherit;
        font-size: 12.5px;
        cursor: pointer;
        text-align: left;
        transition: background 0.14s;
    }
    .pick:hover {
        background: #f8f6f0;
    }
    .pick .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        border: 1.5px solid #cfdfd2;
        flex: 0 0 auto;
    }
    .pick.on {
        background: #e6efe7;
        color: #4d7c5d;
        font-weight: 600;
    }
    .pick.on .dot {
        background: #4d7c5d;
        border-color: #4d7c5d;
    }
</style>
