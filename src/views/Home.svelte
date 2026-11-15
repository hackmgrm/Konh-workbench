<script lang="ts">
    import { toggleTask } from "../lib/taskCompletion";
    import { createEventDispatcher } from "svelte";
    import { tasks, settings, focusRecords, diaries, habits, save } from "../lib/store";
    import { dayKey, greeting } from "../lib/time";
    import { quadOf, MOODS } from "../lib/types";
    import type { Task } from "../lib/types";

    const dispatch = createEventDispatcher<{ goto: "tasks" | "focus" | "diary" }>();

    const QUOTES = [
        { text: "听闻晚风将玫瑰碾碎，在喧嚣的世俗里，万物生长。", from: "佚名" },
        { text: "每一个今天都是你曾经梦想的明天。", from: "佚名" },
        { text: "慢慢来，比较快。", from: "木心" },
        { text: "行动是治愈恐惧的良药，而犹豫拖延将不断滋养恐惧。", from: "威廉·詹姆斯" },
        { text: "把时间花在哪里，人生的花就开在哪里。", from: "佚名" }
    ];

    let quoteIdx = Math.floor(Math.random() * QUOTES.length);
    $: quote = QUOTES[quoteIdx % QUOTES.length];

    let weather = "";
    let weatherCity = "";
    let weatherLoading = false;
    let essay = "";
    let essayLoading = false;
    let essayError = "";

    $: today = dayKey();
    $: now = new Date();
    $: dateLabel = `${now.getMonth() + 1}月${now.getDate()}日星期${"日一二三四五六".charAt(now.getDay())}`;

    $: todays = $focusRecords.filter((f) => f.day === today);
    $: pomos = todays.length;
    $: minutes = todays.reduce((a, b) => a + b.minutes, 0);
    $: open = $tasks.filter((t) => !t.done);
    $: doneToday = $tasks.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === today);
    $: allDone = $tasks.filter((t) => t.done).length;
    $: pct = $tasks.length ? Math.round((allDone / $tasks.length) * 100) : 0;

    $: todayEntry = $diaries[today];
    $: hasDiary = !!(todayEntry && (todayEntry.content || "").trim());

    $: aiReady = !!(($settings.ai.endpoint || "").trim() && ($settings.ai.key || "").trim() && ($settings.ai.model || "").trim());

    $: weekReview = (() => {
        let count = 0;
        const n = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - i);
            count += $tasks.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === dayKey(d)).length;
        }
        return count;
    })();

    /* 往年今日：同月同日的旧日记 */
    $: pastYears = Object.keys($diaries)
        .filter((k) => k.slice(5) === today.slice(5) && k !== today)
        .filter((k) => ($diaries[k].content || "").trim())
        .sort()
        .reverse()
        .slice(0, 3)
        .map((k) => ({ key: k, entry: $diaries[k] }));

    $: todayHabits = $habits;

    function toggleHabit(id: string) {
        habits.update((l) =>
            l.map((h) => {
                if (h.id !== id) return h;
                const rec = { ...h.records };
                if (rec[today]) delete rec[today];
                else rec[today] = 1;
                return { ...h, records: rec };
            })
        );
        save("habits");
    }

    $: if ($settings.weatherCity !== weatherCity) {
        weatherCity = $settings.weatherCity;
        if (weatherCity) void loadWeather();
        else weather = "";
    }

    async function loadWeather() {
        const city = weatherCity.trim();
        if (!city) return;
        weatherLoading = true;
        try {
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t&lang=zh`);
            if (!res.ok) throw new Error("bad");
            const txt = (await res.text()).trim();
            if (!txt || txt.startsWith("<")) throw new Error("bad");
            weather = `${txt} · ${city}`;
        } catch {
            weather = "";
        }
        weatherLoading = false;
    }

    async function genEssay() {
        if (!aiReady || essayLoading) return;
        essayLoading = true;
        essayError = "";
        const names = open.slice(0, 5).map((t) => t.title).join("；");
        try {
            const base = $settings.ai.endpoint.replace(/\/+$/, "");
            const url = base.includes("/chat/completions") ? base : base + "/chat/completions";
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + $settings.ai.key
                },
                body: JSON.stringify({
                    model: $settings.ai.model,
                    messages: [
                        {
                            role: "user",
                            content:
                                `你是我的日记助手。用两三句温和、克制的中文写一段今天的寄语。` +
                                `今天完成 ${doneToday.length} 个任务，专注 ${pomos} 个番茄共 ${minutes} 分钟。` +
                                `待办还有：${names || "没有"}。不要说教，不要用感叹号。`
                        }
                    ],
                    max_tokens: 200,
                    temperature: 0.85
                })
            });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const j = await res.json();
            essay = j?.choices?.[0]?.message?.content?.trim() || "";
            if (!essay) throw new Error("空返回");
        } catch (e) {
            essayError = "生成失败：" + (e instanceof Error ? e.message : String(e));
        }
        essayLoading = false;
    }

    function toggle(t: Task) {
        tasks.update((l) => toggleTask(l, t.id));
        save("tasks");
    }

    function quadTag(t: Task): string {
        return ["I", "II", "III", "IV"][["q1", "q2", "q3", "q4"].indexOf(quadOf(t).key)];
    }
</script>

<div class="hero">
    <div class="hero-left">
        <div class="greet">{greeting()}，欢迎回来！</div>
        <div class="hero-sub">
            <span>📅 {dateLabel}</span>
            <span class="sep">｜</span>
            <span>今天也要元气满满 ✨</span>
        </div>
    </div>
    <div class="hero-right">
        {#if weather}
            <div class="weather">☀ {weather}</div>
        {:else if weatherLoading}
            <div class="weather dim">天气加载中…</div>
        {/if}
    </div>
</div>

<div class="grid-2">
    <button class="review-card" on:click={() => dispatch("goto", "diary")}>
        <div class="rc-head">
            <span>📈 今日回顾</span>
            <span class="rc-link">去写日记 →</span>
        </div>
        <div class="rc-metrics">
            <div class="rc-m green">
                <b>{doneToday.length}</b>
                <span>完成</span>
            </div>
            <div class="rc-m yellow">
                <b>{open.length}</b>
                <span>待办</span>
            </div>
            <div class="rc-m orange">
                <b>{minutes}</b>
                <span>专注分钟</span>
            </div>
        </div>
        <div class="rc-foot">
            {#if hasDiary}
                <span>📖 已记录：{todayEntry.content.slice(0, 40)}…</span>
            {:else}
                <span>📖 今天还没写日记</span>
            {/if}
        </div>
    </button>

    <div class="quote-card ty-card">
        <div class="quote-mark">“</div>
        <div class="quote-text">{quote.text}</div>
        <div class="quote-from">—— {quote.from}</div>
        <div class="quote-foot">
            <span class="quote-tag">✦ DAILY INSPIRATION</span>
            <button class="ty-btn ghost sm" on:click={() => (quoteIdx = quoteIdx + 1)}>换一句</button>
        </div>
    </div>
</div>

{#if pastYears.length > 0}
    <div class="ty-card">
        <div class="ty-h2">🕰 往年今日</div>
        {#each pastYears as p (p.key)}
            <button class="past" on:click={() => dispatch("goto", "diary")}>
                <span class="past-year">{p.key.slice(0, 4)}</span>
                <span class="past-text">
                    {#if p.entry.mood >= 0}<span class="pm">{MOODS[p.entry.mood]}</span>{/if}
                    {p.entry.content.slice(0, 100)}
                </span>
            </button>
        {/each}
    </div>
{/if}

{#if todayHabits.length > 0}
    <div class="ty-card">
        <div class="ty-h2">🌱 今日习惯</div>
        <div class="habits">
            {#each todayHabits as h (h.id)}
                <button
                    class="habit-chip"
                    class:on={h.records[today]}
                    on:click={() => toggleHabit(h.id)}
                    style={h.records[today] ? `background:${h.color};border-color:${h.color};color:#fff` : ""}
                >
                    <span>{h.emoji}</span>
                    {h.name}
                    {#if h.records[today]}<span class="hk">✓</span>{/if}
                </button>
            {/each}
        </div>
    </div>
{/if}

<div class="ty-card">
    <div class="ty-h2">
        <span>✎ AI 散文</span>
        {#if aiReady}
            <button class="ty-btn sm" on:click={genEssay} disabled={essayLoading}>
                {essayLoading ? "生成中…" : essay ? "重写" : "生成散文"}
            </button>
        {/if}
    </div>
    {#if essay}
        <div class="essay">{essay}</div>
    {:else if essayError}
        <div class="ty-dim">{essayError}</div>
    {:else if !aiReady}
        <div class="ty-empty">在「系统设置」里填入 AI 接口后，这里会生成今日散文 ✨</div>
    {:else}
        <div class="ty-empty">点击右上角按钮，让 AI 为你写一篇散文 ✨</div>
    {/if}
</div>

<div class="ty-card">
    <div class="ty-h2">
        <span>☰ 今日任务</span>
        <span class="pill">{open.length} / {$tasks.length}</span>
    </div>
    {#if open.length === 0}
        <div class="ty-empty">🍃 今天没有待办了</div>
    {:else}
        {#each open.slice(0, 8) as t (t.id)}
            <div class="task-row">
                <button class="tk-check" on:click|stopPropagation={() => toggle(t)} aria-label="完成"></button>
                <span class="qbadge q-{quadOf(t).key}">{quadTag(t)}</span>
                <button class="tk-body" on:click={() => dispatch("goto", "tasks")}>
                    <span class="tk-title">{t.title}</span>
                    {#if t.note}<span class="tk-desc">{t.note.slice(0, 40)}</span>{/if}
                </button>
            </div>
        {/each}
    {/if}
</div>

<div class="quick-row">
    <button class="quick" on:click={() => dispatch("goto", "focus")}>
        <span>⏱</span> 去专注
    </button>
    <button class="quick" on:click={() => dispatch("goto", "diary")}>
        <span>✍</span> {hasDiary ? "继续写日记" : "写今天的日记"}
    </button>
</div>

<style>
    .hero {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        background: #fff;
        border-radius: 18px;
        padding: 22px 24px;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
    }
    .greet {
        font-size: 27px;
        font-weight: 700;
        letter-spacing: 0.5px;
        line-height: 1.25;
        background: linear-gradient(92deg, #d18aa6, #b98bbd, #8f93c9);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }
    .hero-sub {
        margin-top: 10px;
        font-size: 12.5px;
        color: #6b7568;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .sep {
        opacity: 0.35;
    }
    .weather {
        font-size: 12.5px;
        color: #4d7c5d;
        background: #e6efe7;
        padding: 7px 13px;
        border-radius: 20px;
        white-space: nowrap;
    }
    .weather.dim {
        color: #9aa398;
        background: #f5f2ea;
    }

    .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }
    .review-card {
        text-align: left;
        border: 0;
        background: #fff;
        border-radius: 18px;
        padding: 16px 18px;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
        cursor: pointer;
        font-family: inherit;
        color: inherit;
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: transform 0.16s, box-shadow 0.16s;
    }
    .review-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 26px rgba(90, 78, 55, 0.1);
    }
    .rc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12.5px;
        font-weight: 700;
    }
    .rc-link {
        font-size: 10.5px;
        color: #4d7c5d;
        font-weight: 400;
    }
    .rc-metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }
    .rc-m {
        border-radius: 12px;
        padding: 10px 8px;
        text-align: center;
    }
    .rc-m.green {
        background: #e9f2ea;
    }
    .rc-m.yellow {
        background: #fbf7ec;
    }
    .rc-m.orange {
        background: #fdf2ee;
    }
    .rc-m b {
        display: block;
        font-size: 19px;
        font-weight: 700;
        color: #2f3a32;
        line-height: 1.2;
    }
    .rc-m span {
        font-size: 10px;
        color: #9aa398;
    }
    .rc-foot {
        font-size: 11px;
        color: #9aa398;
        padding-top: 10px;
        border-top: 1px dashed #f0ece3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .quote-card {
        display: flex;
        flex-direction: column;
        position: relative;
        padding-top: 26px;
        margin: 0;
    }
    .quote-mark {
        position: absolute;
        top: 6px;
        left: 16px;
        font-size: 42px;
        line-height: 1;
        color: #e3ddd0;
        font-family: Georgia, serif;
    }
    .quote-text {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.7;
        letter-spacing: 0.4px;
        padding-left: 6px;
    }
    .quote-from {
        font-size: 11.5px;
        color: #9aa398;
        text-align: right;
        margin-top: 8px;
    }
    .quote-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: auto;
        padding-top: 14px;
        border-top: 1px dashed #ece8df;
    }
    .quote-tag {
        font-size: 10px;
        letter-spacing: 1.2px;
        color: #b9b2a2;
    }

    .past {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        padding: 8px 4px;
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        color: #6b7568;
    }
    .past:hover {
        background: #f8f6f0;
    }
    .past-year {
        flex: 0 0 44px;
        font-size: 11px;
        font-weight: 700;
        color: #4d7c5d;
        background: #e9f2ea;
        padding: 2px 0;
        border-radius: 8px;
        text-align: center;
    }
    .past-text {
        flex: 1;
        font-size: 12px;
        line-height: 1.6;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    .pm {
        margin-right: 4px;
    }

    .habits {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .habit-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid #ece8df;
        background: #fff;
        color: #6b7568;
        font-family: inherit;
        font-size: 11.5px;
        padding: 7px 14px;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .habit-chip:hover {
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .hk {
        font-size: 10px;
    }

    .pill {
        font-size: 10.5px;
        font-weight: 500;
        color: #7f8c7f;
        background: #f3f1ea;
        padding: 3px 10px;
        border-radius: 12px;
    }

    .task-row {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 9px 8px;
        border-radius: 10px;
        transition: background 0.14s, transform 0.14s;
    }
    .task-row:hover {
        background: #f8f6f0;
        transform: translateX(2px);
    }
    .tk-check {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1.5px solid #cfdfd2;
        background: transparent;
        cursor: pointer;
        flex: 0 0 auto;
        padding: 0;
    }
    .tk-check:hover {
        background: #4d7c5d;
        border-color: #4d7c5d;
    }
    .qbadge {
        flex: 0 0 auto;
        font-size: 9.5px;
        font-weight: 700;
        width: 20px;
        height: 20px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .q-q1 {
        background: #fdf0f0;
        color: #b0657f;
    }
    .q-q2 {
        background: #eaf3ea;
        color: #4d7c5d;
    }
    .q-q3 {
        background: #eef4fa;
        color: #5b7fa5;
    }
    .q-q4 {
        background: #faf5e9;
        color: #9a8348;
    }
    .tk-body {
        flex: 1;
        min-width: 0;
        border: 0;
        background: transparent;
        text-align: left;
        font-family: inherit;
        cursor: pointer;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    .tk-title {
        font-size: 12.5px;
        color: #2f3a32;
        line-height: 1.5;
        word-break: break-word;
    }
    .tk-desc {
        font-size: 10.5px;
        color: #b9b2a2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .essay {
        line-height: 1.85;
        font-size: 13px;
    }

    .quick-row {
        display: flex;
        gap: 10px;
    }
    .quick {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 13px;
        border-radius: 14px;
        border: 1px solid #ece8df;
        background: #fff;
        color: #2f3a32;
        font-family: inherit;
        font-size: 12.5px;
        cursor: pointer;
        transition: all 0.16s;
    }
    .quick:hover {
        border-color: #cfdfd2;
        background: #e6efe7;
        color: #4d7c5d;
    }
</style>
