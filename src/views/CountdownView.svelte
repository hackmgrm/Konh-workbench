<script lang="ts">
    import { countdowns, save, uid } from "../lib/store";
    import { dayKey, parseDayKey } from "../lib/time";
    import type { Countdown } from "../lib/types";

    let showAdd = false;
    let draftTitle = "";
    let draftDate = "";
    let draftEmoji = "🎯";

    const EMOJIS = ["🎯", "🎂", "✈️", "📚", "💼", "🏖️", "🎉", "💡", "🌱", "⏰"];

    $: list = $countdowns.slice().sort((a, b) => a.date.localeCompare(b.date));

    function daysLeft(d: string): number {
        const target = parseDayKey(d).getTime();
        const today = parseDayKey(dayKey()).getTime();
        return Math.round((target - today) / 86400000);
    }

    function add() {
        const t = draftTitle.trim();
        if (!t || !draftDate) return;
        const c: Countdown = {
            id: uid(),
            title: t,
            date: draftDate,
            emoji: draftEmoji,
            created: Date.now()
        };
        countdowns.update((l) => [c, ...l]);
        save("countdowns");
        draftTitle = "";
        draftDate = "";
        draftEmoji = "🎯";
        showAdd = false;
    }

    function remove(id: string) {
        countdowns.update((l) => l.filter((x) => x.id !== id));
        save("countdowns");
    }

    function label(n: number): string {
        if (n === 0) return "就是今天";
        if (n > 0) return `还有 ${n} 天`;
        return `已过去 ${-n} 天`;
    }
</script>

<div class="page-head">
    <div>
        <div class="page-title">倒数日</div>
        <div class="page-sub">值得期待的日子，先记下来。</div>
    </div>
    <button class="ty-btn primary" on:click={() => (showAdd = !showAdd)}>
        {showAdd ? "取消" : "+ 新建"}
    </button>
</div>

{#if showAdd}
    <div class="ty-card">
        <div class="emoji-row">
            {#each EMOJIS as e}
                <button class="emoji" class:on={draftEmoji === e} on:click={() => (draftEmoji = e)}>{e}</button>
            {/each}
        </div>
        <div class="ty-row" style="margin-top:10px">
            <input class="ty-input" placeholder="事件名称，比如「年会」" bind:value={draftTitle} />
            <input class="ty-input" type="date" style="flex:0 0 160px" bind:value={draftDate} />
            <button class="ty-btn primary" on:click={add}>创建</button>
        </div>
    </div>
{/if}

{#if list.length === 0}
    <div class="ty-card">
        <div class="ty-empty">还没有倒数日，点右上角新建一个吧 ✨</div>
    </div>
{:else}
    <div class="grid">
        {#each list as c (c.id)}
            {@const n = daysLeft(c.date)}
            <div class="cd-card" class:today={n === 0} class:past={n < 0}>
                <button class="cd-del" on:click={() => remove(c.id)} aria-label="删除">✕</button>
                <div class="cd-emoji">{c.emoji}</div>
                <div class="cd-title">{c.title}</div>
                <div class="cd-days">{Math.abs(n)}</div>
                <div class="cd-label">{label(n)}</div>
                <div class="cd-date">{c.date}</div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .emoji-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }
    .emoji {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid #ece8df;
        background: #fff;
        cursor: pointer;
        font-size: 15px;
        line-height: 1;
    }
    .emoji.on {
        border-color: #4d7c5d;
        background: #e6efe7;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
    }
    .cd-card {
        position: relative;
        background: #fff;
        border-radius: 18px;
        padding: 18px 16px;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
        text-align: center;
        transition: transform 0.16s, box-shadow 0.16s;
    }
    .cd-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 22px rgba(90, 78, 55, 0.1);
    }
    .cd-card.today {
        background: linear-gradient(160deg, #fdf2f1, #fff);
        box-shadow: 0 0 0 1.5px #e2b8c4 inset;
    }
    .cd-card.past {
        opacity: 0.7;
    }
    .cd-del {
        position: absolute;
        top: 8px;
        right: 10px;
        border: 0;
        background: transparent;
        color: #b9b2a2;
        font-size: 11px;
        cursor: pointer;
        opacity: 0;
    }
    .cd-card:hover .cd-del {
        opacity: 0.7;
    }
    .cd-emoji {
        font-size: 24px;
        margin-bottom: 6px;
    }
    .cd-title {
        font-size: 12px;
        color: #6b7568;
        margin-bottom: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .cd-days {
        font-size: 34px;
        font-weight: 700;
        line-height: 1;
        color: #4d7c5d;
        font-variant-numeric: tabular-nums;
    }
    .cd-card.today .cd-days {
        color: #d99ab3;
    }
    .cd-card.past .cd-days {
        color: #9aa398;
    }
    .cd-label {
        font-size: 10.5px;
        color: #9aa398;
        margin-top: 4px;
    }
    .cd-date {
        font-size: 10px;
        color: #b9b2a2;
        margin-top: 8px;
        letter-spacing: 0.4px;
    }
</style>
