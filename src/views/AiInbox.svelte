<script lang="ts">
    import { tasks, settings, save, uid } from "../lib/store";
    import { extractInboxTasks, inboxToTask, validateInboxTasks, type InboxTask } from "../lib/aiInbox";

    export let visible = true;
    export let onClose: () => void = () => {};

    let inboxText = "";
    let inboxLoading = false;
    let inboxSaving = false;
    let inboxError = "";
    let inboxMessage = "";
    let inboxPreview: (InboxTask & { selected: boolean })[] = [];

    async function extractInbox() {
        if (inboxLoading || inboxSaving) return;
        if (!inboxText.trim()) { inboxError = "请输入需要整理的文本。"; return; }
        inboxLoading = true;
        inboxError = "";
        inboxMessage = "";
        inboxPreview = [];
        try {
            const result = await extractInboxTasks($settings.ai, inboxText.trim());
            inboxPreview = result.map((item) => ({ ...item, selected: true }));
            if (!result.length) inboxMessage = "没有发现明确待办，请修改文本后重试。";
        } catch (error) {
            inboxError = error instanceof Error ? error.message : "AI 请求失败。";
        } finally { inboxLoading = false; }
    }

    function confirmInbox() {
        if (inboxLoading || inboxSaving) return;
        inboxSaving = true;
        try {
            const selected = inboxPreview.filter((item) => item.selected);
            if (!selected.length) { inboxError = "请至少选择一项待办。"; return; }
            const valid = validateInboxTasks(selected);
            const added = valid.map((item) => inboxToTask(item, uid()));
            tasks.update((list) => [...added, ...list]);
            save("tasks");
            inboxPreview = [];
            inboxText = "";
            inboxError = "";
            inboxMessage = `已添加 ${added.length} 项待办。`;
        } catch (error) {
            inboxError = error instanceof Error ? error.message : "添加失败。";
        } finally { inboxSaving = false; }
    }

</script>

{#if visible}
    <section class="inbox" aria-label="AI 智能收集箱">
        <strong>AI 智能收集箱</strong>
        <div><button class="ty-btn sm" on:click={onClose}>关闭</button></div>
        <p>点击提取后，输入内容将发送至设置中的 AI 服务提供商，请勿输入不愿分享的敏感信息。浏览器直连需要服务端允许当前来源及 Authorization 请求头（CORS）。</p>
        <textarea aria-label="待整理文本" bind:value={inboxText} disabled={inboxLoading} placeholder="粘贴笔记、工单或待办想法…"></textarea>
        <div><button class="ty-btn sm" disabled={inboxLoading || inboxSaving} on:click={extractInbox}>{inboxLoading ? "正在提取…" : "提取待办"}</button></div>
        {#if inboxError}<p role="alert">{inboxError}</p>{/if}
        {#if inboxMessage}<p role="status">{inboxMessage}</p>{/if}
        {#if inboxPreview.length}
            <p>请检查并编辑，只有确认后才会添加。截止时间保存到任务备注中，不会设置提醒。</p>
            {#each inboxPreview as item, i}
                <div class="inbox-item">
                    <label><input type="checkbox" bind:checked={item.selected} /> 选择第 {i + 1} 项</label>
                    <label>标题 <input bind:value={item.title} /></label>
                    <label>描述 <textarea bind:value={item.description}></textarea></label>
                    <label>备注 <textarea bind:value={item.notes}></textarea></label>
                    <label>截止日期 <input type="date" bind:value={item.dueDate} /></label>
                    <label>截止时间 <input type="time" bind:value={item.dueTime} /></label>
                    <label>象限 <select bind:value={item.category}>
                        <option value="urgent-important">重要且紧急</option><option value="important-not-urgent">重要不紧急</option>
                        <option value="urgent-not-important">紧急不重要</option><option value="not-urgent-not-important">不重要不紧急</option>
                    </select></label>
                </div>
            {/each}
            <button class="ty-btn sm" disabled={inboxLoading || inboxSaving} on:click={confirmInbox}>确认添加所选待办</button>
        {/if}
    </section>
{/if}

<style>
    .inbox { background: var(--card); border: 1px solid var(--b3-border-color); border-radius: 12px; padding: 14px; display: grid; gap: 8px; }
    .inbox p { margin: 0; color: var(--text-2); font-size: 12px; }
    .inbox textarea, .inbox input:not([type=checkbox]), .inbox select { box-sizing: border-box; width: 100%; padding: 6px; color: var(--text); background: var(--card); border: 1px solid var(--b3-border-color); border-radius: 6px; font: inherit; }
    .inbox textarea { min-height: 65px; resize: vertical; }
    .inbox-item { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--b3-border-color); border-radius: 8px; }
    .inbox-item label { display: block; font-size: 12px; }
</style>
