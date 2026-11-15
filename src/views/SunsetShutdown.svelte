<script lang="ts">
    import { onMount } from "svelte";
    import { diaries, focusRecords, tasks, save } from "../lib/store";
    import { dayKey } from "../lib/time";
    import { extractTags, type JournalEntry } from "../lib/types";
    import { sfxBell, sfxPaper } from "../lib/sound";
    import { calculateSunsetStats, getTomorrowString } from "../lib/sunsetShutdown";

    export let onClose: () => void;

    const today = dayKey();
    const tomorrow = getTomorrowString();
    let step: 1 | 2 | 3 | 4 = 1;
    let selectedIds: string[] = [];
    let initialized = false;
    let launchpad = "";

    $: stats = calculateSunsetStats($tasks, $focusRecords, today);
    $: if (!initialized) {
        selectedIds = stats.uncompletedTasks.map((task) => task.id);
        initialized = true;
    }

    onMount(() => {
        try {
            const raw = localStorage.getItem("tongyun_tomorrow_launchpad");
            if (raw) {
                const saved = JSON.parse(raw) as { date?: string; text?: string };
                if (saved.date === tomorrow && typeof saved.text === "string") launchpad = saved.text;
            }
        } catch {
            /* 忽略损坏的本地草稿 */
        }
        const timer = window.setTimeout(() => sfxPaper(), 450);
        return () => window.clearTimeout(timer);
    });

    function onKey(event: KeyboardEvent) {
        if (event.key === "Escape") onClose();
    }

    function toggleTask(id: string) {
        selectedIds = selectedIds.includes(id)
            ? selectedIds.filter((item) => item !== id)
            : [...selectedIds, id];
    }

    function postponeSelected() {
        if (selectedIds.length) {
            const selected = new Set(selectedIds);
            tasks.update((list) => list.map((task) => selected.has(task.id) ? { ...task, due: tomorrow } : task));
            save("tasks", true);
        }
        step = 3;
    }

    function emptyDiary(): JournalEntry {
        return { content: "", mood: -1, tags: [], aiComment: "", updatedAt: 0 };
    }

    function saveLaunchpad() {
        const text = launchpad.trim();
        if (text) {
            try { localStorage.setItem("tongyun_tomorrow_launchpad", JSON.stringify({ date: tomorrow, text })); } catch { /* ignore */ }
            diaries.update((map) => {
                const current = map[today] || emptyDiary();
                const note = `> 🌅 **日落离线 · 明日启动锚点**：${text}`;
                const content = current.content.trim() ? `${current.content.trim()}\n\n${note}` : note;
                return { ...map, [today]: { ...current, content, tags: extractTags(content), updatedAt: Date.now() } };
            });
            save("diaries", true);
        }
        try { localStorage.setItem("tongyun_last_sunset_date", today); } catch { /* ignore */ }
        sfxBell();
        step = 4;
    }

    function stepBack(next: 1 | 2) { step = next; }
</script>

<svelte:window on:keydown={onKey} />

<div class="sunset-mask" role="presentation" on:click={(event) => event.target === event.currentTarget && onClose()}>
    <div class="sunset-modal" role="dialog" aria-modal="true" aria-labelledby="sunset-title">
        <div class="sunset-strip"></div>
        <header class="sunset-header">
            <div class="sunset-heading">
                <div class="sunset-icon">🌅</div>
                <div>
                    <h2 id="sunset-title">日落离线仪轨 · 晚安手帐</h2>
                    <p>卸下载荷，整理今日所得，体面告别工作日</p>
                </div>
            </div>
            <button class="sunset-close" aria-label="关闭日落离线" on:click={onClose}>×</button>
        </header>

        <div class="sunset-body">
            {#if step === 1}
                <div class="sunset-step centered">
                    <span class="step-label">STEP 1 / 3 · 今日清点</span>
                    <h3>辛苦了一整天，先看看今日的耕耘</h3>
                    <p class="step-desc">每个微小的推进，都是今天实打实的成长</p>
                    <div class="stat-grid">
                        <div class="sunset-stat green"><strong>{stats.completedCount}</strong><span>今日完成任务</span></div>
                        <div class="sunset-stat amber"><strong>{stats.totalFocusMinutes}<small>m</small></strong><span>专注心流时长</span></div>
                        <div class="sunset-stat rose"><strong>{stats.pomodoroCount}</strong><span>完成番茄钟</span></div>
                    </div>
                    <div class="stamp-wrap"><div class="stamp">★ 今日圆满 ★<small>GOOD WORK</small></div></div>
                    <button class="sunset-action primary full" on:click={() => (step = 2)}>下一步：安顿游离待办 <span>→</span></button>
                </div>
            {:else if step === 2}
                <div class="sunset-step">
                    <span class="step-label">STEP 2 / 3 · 安顿未完成</span>
                    <h3>不要把悬而未决的任务留在脑子里</h3>
                    <p class="step-desc">未完成很正常。勾选的任务将一键顺延至明日，让今晚安心休息。</p>
                    {#if stats.uncompletedTasks.length === 0}
                        <div class="sunset-empty"><div>✓</div><strong>太赞了！今日截止待办已全部清空！</strong><span>没有任何悬空任务打扰你的夜晚。</span></div>
                    {:else}
                        <div class="sunset-task-list">
                            {#each stats.uncompletedTasks as task (task.id)}
                                <button class="sunset-task" class:selected={selectedIds.includes(task.id)} on:click={() => toggleTask(task.id)}>
                                    <span class="fake-check">{selectedIds.includes(task.id) ? "✓" : ""}</span>
                                    <span class="task-name">{task.title}</span>
                                    <span class="postpone">↗ 明日</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                    <div class="sunset-actions"><button class="sunset-action" on:click={() => stepBack(1)}>上一步</button><button class="sunset-action orange" on:click={postponeSelected}>{selectedIds.length ? `一键顺延 (${selectedIds.length} 项) 并继续` : "跳过顺延，继续下一步"} <span>→</span></button></div>
                </div>
            {:else if step === 3}
                <div class="sunset-step">
                    <span class="step-label">STEP 3 / 3 · 明日启动锚点</span>
                    <h3>写下一句明天上班第一件要做的事</h3>
                    <p class="step-desc">清晰的启动锚点能让明天的你 1 秒进入状态，消除今晚的大脑内存占用。</p>
                    <label class="launchpad"><span>🧭</span><textarea bind:value={launchpad} rows="4" placeholder="例：明天一早先拉取最新代码，跑通支付回调单测..."></textarea></label>
                    <div class="presets">
                        {#each ["明天上午先把第 1 象限核心待办攻坚掉", "复盘这周日记与专注热力图", "把未完文档补充完闭环"] as preset}
                            <button on:click={() => (launchpad = preset)}>{preset}</button>
                        {/each}
                    </div>
                    <div class="sunset-actions"><button class="sunset-action" on:click={() => stepBack(2)}>上一步</button><button class="sunset-action orange" on:click={saveLaunchpad}>合上手帐 · 开启美好生活 <span>☾</span></button></div>
                </div>
            {:else}
                <div class="sunset-step centered done-step">
                    <div class="moon">☾</div>
                    <h3>晚安，今日工作已体面收官</h3>
                    <p class="step-desc">所有的事情明天都有安排。现在，请放下屏幕，去散步、去陪伴家人、去享受属于你的时间。</p>
                    {#if launchpad.trim()}<div class="launchpad-result"><strong>🧭 明日启动锚点已就绪：</strong><span>{launchpad.trim()}</span></div>{/if}
                    <button class="sunset-action primary" on:click={onClose}>我知道了，合上手帐</button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .sunset-mask { position: fixed; inset: 0; z-index: 10008; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(48, 39, 29, .48); backdrop-filter: blur(5px); }
    .sunset-modal { width: min(590px, 94vw); max-height: min(700px, 90vh); display: flex; flex-direction: column; overflow: hidden; color: #2f3a32; background: #fdfbf7; border: 1px solid #ebe5d8; border-radius: 18px; box-shadow: 0 24px 70px rgba(50, 38, 24, .28); animation: sunset-in .25s ease-out; }
    .sunset-strip { height: 7px; flex: 0 0 auto; background: linear-gradient(90deg, #f2b04c, #ef8b4e, #d87573); }
    .sunset-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #efebe4; background: rgba(255,255,255,.45); }
    .sunset-heading { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .sunset-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px; background: #fff0df; font-size: 18px; }
    h2, h3, p { margin: 0; } h2 { font-size: 14px; letter-spacing: .2px; } .sunset-heading p { margin-top: 3px; color: #9aa398; font-size: 10px; }
    .sunset-close { border: 0; background: transparent; color: #9aa398; font-size: 24px; line-height: 1; padding: 2px 5px; cursor: pointer; border-radius: 7px; } .sunset-close:hover { background: #f3eee5; color: #59645a; }
    .sunset-body { overflow-y: auto; padding: 25px; } .sunset-step { display: flex; flex-direction: column; gap: 10px; } .centered { align-items: center; text-align: center; }
    .step-label { align-self: flex-start; color: #d97706; background: #fff4e7; border-radius: 999px; padding: 5px 9px; font-size: 10px; font-weight: 800; letter-spacing: 1px; } .centered .step-label { align-self: center; }
    h3 { margin-top: 1px; font-size: 18px; line-height: 1.4; } .step-desc { color: #89938a; font-size: 11.5px; line-height: 1.7; }
    .stat-grid { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 2px; } .sunset-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 15px 7px; border: 1px solid #efebe4; border-radius: 13px; background: #fff; box-shadow: 0 2px 8px rgba(100,80,50,.04); } .sunset-stat strong { font-size: 27px; line-height: 1; font-variant-numeric: tabular-nums; } .sunset-stat small { margin-left: 2px; font-size: 11px; } .sunset-stat span { color: #9aa398; font-size: 10px; } .green strong { color: #4d7c5d; } .amber strong { color: #c5811b; } .rose strong { color: #c96a72; }
    .stamp-wrap { height: 102px; display: grid; place-items: center; } .stamp { padding: 10px 15px 7px; color: #a33a2c; border: 2px solid #a33a2c; border-radius: 11px; font-size: 17px; font-weight: 900; letter-spacing: 2px; transform: rotate(-7deg); background: rgba(163,58,44,.04); animation: stamp-in .5s .35s both; } .stamp small { display: block; margin-top: 3px; font-size: 8px; letter-spacing: 2px; opacity: .7; }
    .sunset-action { border: 1px solid #e8e3da; border-radius: 10px; padding: 10px 14px; color: #637064; background: #fff; font: inherit; font-size: 11.5px; cursor: pointer; transition: .15s; } .sunset-action:hover { border-color: #c7d9c9; color: #4d7c5d; background: #f8fbf7; } .sunset-action.primary { color: #fff; border-color: #4d7c5d; background: #4d7c5d; font-weight: 700; } .sunset-action.primary:hover { background: #3f684c; color: #fff; } .sunset-action.orange { color: #fff; border-color: #e77839; background: linear-gradient(100deg,#e99533,#dd6f5c); font-weight: 700; } .sunset-action.orange:hover { color: #fff; filter: brightness(.96); } .sunset-action.full { width: 100%; } .sunset-action span { margin-left: 5px; }
    .sunset-actions { display: flex; gap: 8px; margin-top: 8px; } .sunset-actions .orange { flex: 1; }
    .sunset-task-list { display: flex; flex-direction: column; gap: 7px; max-height: 245px; overflow-y: auto; padding: 3px 1px; } .sunset-task { width: 100%; display: flex; align-items: center; gap: 9px; border: 1px solid #e8e4dc; border-radius: 11px; padding: 10px; text-align: left; color: #455146; background: #fff; cursor: pointer; } .sunset-task.selected { border-color: #edb77b; background: #fff7ed; } .fake-check { width: 15px; height: 15px; flex: 0 0 15px; display: grid; place-items: center; border: 1px solid #d3cec4; border-radius: 4px; color: #fff; background: #fff; font-size: 10px; } .selected .fake-check { border-color: #dd8630; background: #dd8630; } .task-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; } .postpone { color: #d48328; font-size: 10px; }
    .sunset-empty { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 30px 12px; margin-top: 6px; border: 1px solid #efebe4; border-radius: 13px; background: #fff; } .sunset-empty div { color: #4d7c5d; font-size: 27px; } .sunset-empty strong { color: #4d7c5d; font-size: 12px; } .sunset-empty span { color: #9aa398; font-size: 10px; }
    .launchpad { display: flex; gap: 8px; padding: 10px; margin-top: 7px; border: 1px solid #e6e0d5; border-radius: 12px; background: #fff; } .launchpad > span { font-size: 17px; } textarea { flex: 1; min-width: 0; resize: vertical; border: 0; outline: 0; color: #354236; background: transparent; font: inherit; font-size: 12px; line-height: 1.6; } textarea::placeholder { color: #b1b7b0; }
    .presets { display: flex; flex-wrap: wrap; gap: 5px; } .presets button { border: 0; border-radius: 6px; padding: 5px 7px; color: #7f887f; background: #f3f1eb; font: inherit; font-size: 9.5px; cursor: pointer; } .presets button:hover { color: #d47728; background: #fff0dd; }
    .done-step { padding: 18px 10px 7px; gap: 12px; } .moon { width: 66px; height: 66px; display: grid; place-items: center; border-radius: 50%; color: #626da6; background: linear-gradient(135deg,#eeeafd,#f9edee); font-size: 38px; box-shadow: inset 0 2px 8px rgba(120,100,160,.12); } .done-step h3 { font-size: 20px; font-family: Georgia, serif; } .launchpad-result { width: min(390px,100%); padding: 11px 13px; border: 1px solid #efdcab; border-radius: 11px; color: #80622b; background: #fff8e7; text-align: left; font-size: 11px; line-height: 1.65; } .launchpad-result strong, .launchpad-result span { display: block; } .launchpad-result span { margin-top: 3px; font-style: italic; }
    @keyframes sunset-in { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } } @keyframes stamp-in { from { opacity: 0; transform: rotate(-7deg) scale(2); } to { opacity: 1; transform: rotate(-7deg) scale(1); } }
    :global(.ty-root.dark) .sunset-modal { color: #e8e9e5; background: #202329; border-color: #34373d; } :global(.ty-root.dark) .sunset-header, :global(.ty-root.dark) .sunset-stat, :global(.ty-root.dark) .sunset-task, :global(.ty-root.dark) .sunset-empty, :global(.ty-root.dark) .launchpad { background: #282b31; border-color: #3a3d44; } :global(.ty-root.dark) .sunset-heading p, :global(.ty-root.dark) .step-desc, :global(.ty-root.dark) .sunset-stat span, :global(.ty-root.dark) .sunset-empty span { color: #9da39d; } :global(.ty-root.dark) .sunset-task { color: #d9ddd7; } :global(.ty-root.dark) .sunset-task.selected { background: #3a3025; border-color: #9b6734; } :global(.ty-root.dark) textarea { color: #e8e9e5; } :global(.ty-root.dark) .sunset-action { color: #c5ccc4; background: #282b31; border-color: #3a3d44; } :global(.ty-root.dark) .sunset-action.primary { color: #fff; background: #4d7c5d; } :global(.ty-root.dark) .presets button { color: #b1b6b0; background: #34373d; }
    @media (max-width: 520px) { .sunset-body { padding: 18px; } .stat-grid { gap: 6px; } .sunset-stat { padding: 12px 3px; } .sunset-stat strong { font-size: 23px; } .sunset-stat span { font-size: 9px; } .sunset-actions { flex-direction: column; } .sunset-actions .orange { order: -1; } }
</style>
