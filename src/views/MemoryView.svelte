<script lang="ts">
    import { diaries, tasks, focusRecords } from "../lib/store";
    import { dayKey, parseDayKey, fmtTime } from "../lib/time";
    import { MOODS } from "../lib/types";

    export let onOpenJournal: (date: string) => void;

    let monthOffset = 0;
    let filter: "all" | "journal" | "task" | "focus" = "all";
    let drawn: { kind: string; date: string; title: string; body: string; mood: number; extra: string } | null = null;

    $: cursor = (() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
    })();

    $: ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    $: monthLabel = `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`;

    function inMonth(key: string): boolean {
        return key.startsWith(ym);
    }

    /* ---------- 本月数据 ---------- */
    $: monthDiaries = Object.keys($diaries)
        .filter((k) => inMonth(k) && ($diaries[k].content || "").trim())
        .sort()
        .reverse();

    $: monthDoneTasks = $tasks.filter(
        (t) => t.done && t.doneAt && inMonth(dayKey(new Date(t.doneAt)))
    );

    $: monthFocus = $focusRecords.filter((f) => inMonth(f.day));
    $: monthMinutes = monthFocus.reduce((a, b) => a + b.minutes, 0);

    $: moodCounts = (() => {
        const map: Record<number, number> = {};
        monthDiaries.forEach((k) => {
            const m = $diaries[k].mood;
            if (m >= 0 && m <= 4) map[m] = (map[m] || 0) + 1;
        });
        const arr = Object.keys(map)
            .map((k) => ({ mood: Number(k), count: map[Number(k)] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
        return arr;
    })();

    /* ---------- 时间线 ---------- */
    $: timeline = (() => {
        const dates = new Set<string>();
        monthDiaries.forEach((k) => dates.add(k));
        monthDoneTasks.forEach((t) => dates.add(dayKey(new Date(t.doneAt))));
        monthFocus.forEach((f) => dates.add(f.day));

        return Array.from(dates)
            .sort()
            .reverse()
            .map((d) => {
                const j = $diaries[d];
                const ts = monthDoneTasks.filter((t) => dayKey(new Date(t.doneAt)) === d);
                const fs = monthFocus.filter((f) => f.day === d);
                const mins = fs.reduce((a, b) => a + b.minutes, 0);
                return { date: d, journal: j && (j.content || "").trim() ? j : null, tasks: ts, focusCount: fs.length, focusMin: mins };
            })
            .filter((row) => {
                if (filter === "journal") return !!row.journal;
                if (filter === "task") return row.tasks.length > 0;
                if (filter === "focus") return row.focusCount > 0;
                return true;
            });
    })();

    /* ---------- 随机记忆卡 ---------- */
    function drawMemory() {
        const pool: NonNullable<typeof drawn>[] = [];

        Object.keys($diaries).forEach((k) => {
            const j = $diaries[k];
            if (!(j.content || "").trim()) return;
            pool.push({
                kind: "日记",
                date: k,
                title: j.content.split("\n")[0].slice(0, 40),
                body: j.content.slice(0, 260),
                mood: j.mood,
                extra: j.aiComment || ""
            });
        });

        $tasks.filter((t) => t.done).forEach((t) => {
            pool.push({
                kind: "完成",
                date: dayKey(new Date(t.doneAt || t.created)),
                title: t.title,
                body: t.note || "",
                mood: -1,
                extra: t.tags.length ? t.tags.join(" · ") : ""
            });
        });

        $focusRecords.forEach((f) => {
            pool.push({
                kind: "专注",
                date: f.day,
                title: `${f.minutes} 分钟的专注`,
                body: "那段时间里，你只做了一件事。",
                mood: -1,
                extra: ""
            });
        });

        if (pool.length === 0) {
            drawn = { kind: "空", date: dayKey(), title: "还没有留下印记", body: "写一篇日记，或者完成一个任务，这里就会有回忆可抽。", mood: -1, extra: "" };
            return;
        }
        drawn = pool[Math.floor(Math.random() * pool.length)];
    }

    function shiftMonth(delta: number) {
        const next = monthOffset + delta;
        if (next > 0) return;
        if (next < -36) return;
        monthOffset = next;
    }

    function moodEmoji(m: number): string {
        return m >= 0 && m <= 4 ? MOODS[m] : "";
    }
</script>

<div class="page-head">
    <div>
        <div class="page-title">时光长廊 · 岁月印记</div>
        <div class="page-sub">翻一翻走过的日子，看看自己留下了什么。</div>
    </div>
    <button class="ty-btn primary" on:click={drawMemory}>🎴 随机记忆</button>
</div>

<div class="month-bar">
    <button class="ty-btn ghost sm" on:click={() => shiftMonth(-1)}>‹ 上一月</button>
    <span class="month-label">{monthLabel}</span>
    <button class="ty-btn ghost sm" on:click={() => shiftMonth(1)} disabled={monthOffset >= 0}>下一月 ›</button>
</div>

<div class="stat-row">
    <div class="stat-card pink">
        <b>{monthDiaries.length}</b>
        <span>篇日记</span>
    </div>
    <div class="stat-card green">
        <b>{monthDoneTasks.length}</b>
        <span>个任务完成</span>
    </div>
    <div class="stat-card blue">
        <b>{(monthMinutes / 60).toFixed(1)}</b>
        <span>小时专注</span>
    </div>
    <div class="stat-card yellow">
        {#if moodCounts.length === 0}
            <b>—</b>
            <span>没有心情记录</span>
        {:else}
            <div class="moods">
                {#each moodCounts as m (m.mood)}
                    <span>{MOODS[m.mood]}<i>{m.count}</i></span>
                {/each}
            </div>
            <span>本月心情</span>
        {/if}
    </div>
</div>

<div class="filters">
    {#each [["all", "全部印记"], ["journal", "日记与手账"], ["task", "完成高光"], ["focus", "专注足迹"]] as f}
        <button class="fchip" class:on={filter === f[0]} on:click={() => (filter = f[0] as typeof filter)}>
            {f[1]}
        </button>
    {/each}
</div>

{#if timeline.length === 0}
    <div class="ty-card">
        <div class="ty-empty">这个月还没有印记。写点东西，或者完成一个任务吧 ✨</div>
    </div>
{:else}
    <div class="timeline">
        {#each timeline as row (row.date)}
            <div class="tl-day">
                <div class="tl-date">
                    <div class="tl-d">{parseDayKey(row.date).getDate()}</div>
                    <div class="tl-w">{row.date.slice(5)}</div>
                </div>

                <div class="tl-body">
                    {#if row.journal}
                        <div class="tl-card journal" role="button" tabindex="0" on:click={() => onOpenJournal(row.date)} on:keydown={(e) => e.key === "Enter" && onOpenJournal(row.date)}>
                            <div class="card-head">
                                <span class="tag">日记</span>
                                {#if row.journal.mood >= 0}<span class="mood">{MOODS[row.journal.mood]}</span>{/if}
                                <span class="sp"></span>
                                <span class="hint">查阅日记本 →</span>
                            </div>
                            <div class="card-text">{row.journal.content.slice(0, 160)}</div>
                            {#if row.journal.aiComment}
                                <div class="card-ai">✎ {row.journal.aiComment.slice(0, 80)}</div>
                            {/if}
                        </div>
                    {/if}

                    {#if row.tasks.length > 0}
                        <div class="tl-card task">
                            <div class="card-head">
                                <span class="tag green">完成 {row.tasks.length} 项</span>
                            </div>
                            <div class="task-lines">
                                {#each row.tasks.slice(0, 4) as t (t.id)}
                                    <div class="task-line">
                                        <span class="ck">✓</span>
                                        <span>{t.title}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if row.focusCount > 0}
                        <div class="tl-card focus">
                            <div class="card-head">
                                <span class="tag blue">专注 {row.focusCount} 个番茄</span>
                                <span class="sp"></span>
                                <span class="hint">{row.focusMin} 分钟</span>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
{/if}

{#if drawn}
    <div class="mem-mask" role="presentation" on:click={(e) => e.target === e.currentTarget && (drawn = null)}>
        <div class="polaroid">
            <div class="p-kind">{drawn.kind} · {drawn.date}</div>
            <div class="p-title">{drawn.title}</div>
            <div class="p-body">{drawn.body}</div>
            {#if drawn.extra}<div class="p-extra">{drawn.extra}</div>{/if}
            {#if drawn.mood >= 0}<div class="p-mood">{MOODS[drawn.mood]}</div>{/if}
            <div class="p-acts">
                <button class="ty-btn sm" on:click={drawMemory}>再抽一张</button>
                <button class="ty-btn sm primary" on:click={() => (drawn = null)}>收下感悟</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .month-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
    }
    .month-label {
        font-size: 14px;
        font-weight: 700;
        min-width: 120px;
        text-align: center;
    }
    .stat-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
    }
    .stat-card {
        border-radius: 16px;
        padding: 15px 16px;
        text-align: center;
    }
    .stat-card.pink {
        background: #fdf2f1;
    }
    .stat-card.green {
        background: #e9f2ea;
    }
    .stat-card.blue {
        background: #eff4fa;
    }
    .stat-card.yellow {
        background: #fbf7ec;
    }
    .stat-card b {
        display: block;
        font-size: 24px;
        font-weight: 700;
        color: #2f3a32;
        line-height: 1.2;
    }
    .stat-card span {
        font-size: 10.5px;
        color: #9aa398;
    }
    .moods {
        display: flex;
        justify-content: center;
        gap: 8px;
        font-size: 17px;
        line-height: 1.5;
    }
    .moods i {
        font-style: normal;
        font-size: 10px;
        color: #9aa398;
        margin-left: 2px;
    }

    .filters {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }
    .fchip {
        border: 1px solid #ece8df;
        background: #fff;
        color: #6b7568;
        font-family: inherit;
        font-size: 11.5px;
        padding: 6px 14px;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .fchip:hover {
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .fchip.on {
        background: #4d7c5d;
        border-color: #4d7c5d;
        color: #fff;
    }

    .timeline {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }
    .tl-day {
        display: flex;
        gap: 14px;
    }
    .tl-date {
        flex: 0 0 52px;
        text-align: center;
        padding-top: 4px;
    }
    .tl-d {
        font-size: 20px;
        font-weight: 700;
        color: #2f3a32;
        line-height: 1.1;
    }
    .tl-w {
        font-size: 9.5px;
        color: #b9b2a2;
    }
    .tl-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .tl-card {
        background: #fff;
        border-radius: 14px;
        padding: 12px 14px;
        box-shadow: 0 2px 12px rgba(90, 78, 55, 0.05);
    }
    .tl-card.journal {
        cursor: pointer;
        transition: box-shadow 0.15s, transform 0.15s;
    }
    .tl-card.journal:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(90, 78, 55, 0.09);
    }
    .card-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 7px;
    }
    .tag {
        font-size: 10px;
        padding: 2px 9px;
        border-radius: 10px;
        background: #fdf2f1;
        color: #b0657f;
    }
    .tag.green {
        background: #e9f2ea;
        color: #4d7c5d;
    }
    .tag.blue {
        background: #eff4fa;
        color: #5b7fa5;
    }
    .mood {
        font-size: 13px;
    }
    .sp {
        flex: 1;
    }
    .hint {
        font-size: 10px;
        color: #b9b2a2;
    }
    .card-text {
        font-size: 12px;
        color: #6b7568;
        line-height: 1.7;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .card-ai {
        margin-top: 8px;
        font-size: 11px;
        color: #8b7f9b;
        background: #f7f4fa;
        padding: 7px 10px;
        border-radius: 9px;
    }
    .task-lines {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .task-line {
        display: flex;
        gap: 7px;
        font-size: 11.5px;
        color: #6b7568;
    }
    .ck {
        color: #4d7c5d;
        flex: 0 0 auto;
    }

    .mem-mask {
        position: fixed;
        inset: 0;
        z-index: 10005;
        background: rgba(50, 42, 30, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .polaroid {
        width: min(360px, 86vw);
        background: #fffdf7;
        border-radius: 4px;
        padding: 20px 20px 16px;
        box-shadow: 0 20px 60px rgba(40, 32, 20, 0.35);
        transform: rotate(-1.2deg);
        border: 1px solid #efe9db;
    }
    .p-kind {
        font-size: 10px;
        color: #b9b2a2;
        letter-spacing: 1px;
    }
    .p-title {
        font-size: 16px;
        font-weight: 700;
        margin: 8px 0 10px;
        color: #2f3a32;
        line-height: 1.4;
    }
    .p-body {
        font-size: 12.5px;
        color: #6b7568;
        line-height: 1.75;
        white-space: pre-wrap;
        max-height: 220px;
        overflow-y: auto;
    }
    .p-extra {
        margin-top: 10px;
        font-size: 11px;
        color: #8b7f9b;
        background: #f7f4fa;
        padding: 8px 10px;
        border-radius: 8px;
    }
    .p-mood {
        margin-top: 10px;
        font-size: 20px;
    }
    .p-acts {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 16px;
    }
</style>
