<script lang="ts">
    import { settings, tasks, stickies, diaries, focusRecords, favorites, save, uid } from "../lib/store";
    import type { NoiseEngine } from "../lib/noise";
    import { exportBackup, importBackup, parseBackup } from "../lib/backup";

    export let noise: NoiseEngine;

    let includeAiKey = false;
    let backupBusy = false;
    let backupMessage = "";
    let backupError = "";

    function downloadBackup() {
        try {
            const blob = new Blob([exportBackup(includeAiKey)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Konh-workbench-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            backupError = "";
            backupMessage = includeAiKey ? "备份已导出，文件包含 AI API Key，请妥善保管。" : "备份已导出，未包含 AI API Key。";
        } catch (e) { backupError = e instanceof Error ? e.message : String(e); }
    }

    async function chooseBackup(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        backupMessage = "";
        backupError = "";
        if (!file) return;
        backupBusy = true;
        try {
            if (file.size > 20 * 1024 * 1024) throw new Error("备份文件超过 20 MB");
            const data = parseBackup(await file.text());
            const tasksN = data.tasks.length, diariesN = Object.keys(data.diaries).length;
            const ok = window.confirm(`已验证备份格式。\n\n将合并任务 ${tasksN} 条、日记 ${diariesN} 篇及其他数据。已有 ID 和已有日期的日记将保留本机版本；设置将使用备份值（订阅按 ID 合并，未包含的 AI Key 保留本机值）。\n\n是否继续导入？`);
            if (!ok) return;
            await importBackup(data);
            backupMessage = "导入完成。重复 ID 与已有日期的日记均已跳过；设置已按提示导入。";
        } catch (err) { backupError = err instanceof Error ? err.message : String(err); }
        finally { backupBusy = false; }
    }

    let feedName = "";
    let feedUrl = "";

    function addFeed() {
        const url = feedUrl.trim();
        if (!url) return;
        const name = feedName.trim() || url.replace(/^https?:\/\//, "").split("/")[0];
        settings.update((s) => ({
            ...s,
            rssFeeds: [...(s.rssFeeds || []), { id: uid(), name, url }]
        }));
        save("settings");
        feedName = "";
        feedUrl = "";
    }

    function removeFeed(id: string) {
        settings.update((s) => ({
            ...s,
            rssFeeds: (s.rssFeeds || []).filter((f) => f.id !== id)
        }));
        save("settings");
    }

    function toggleDark(e: Event) {
        const on = (e.target as HTMLInputElement).checked;
        settings.update((s) => ({ ...s, dark: on }));
        save("settings");
    }

    function toggleSound(e: Event) {
        const on = (e.target as HTMLInputElement).checked;
        settings.update((s) => ({ ...s, soundOn: on }));
        save("settings");
    }

    function togglePraise(e: Event) {
        const on = (e.target as HTMLInputElement).checked;
        settings.update((s) => ({ ...s, praiseOn: on }));
        save("settings");
    }

    let poolLoading = false;
    let poolCount = 0;

    function readPool(): string[] {
        try {
            const raw = window.localStorage.getItem("tongyun_ai_praise");
            const arr = raw ? (JSON.parse(raw) as string[]) : [];
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }

    poolCount = readPool().length;

    async function genPraisePool() {
        const a = $settings.ai;
        if (!a.endpoint || !a.key || !a.model) return;
        poolLoading = true;
        try {
            const base = a.endpoint.replace(/\/+$/, "");
            const url = base.includes("/chat/completions") ? base : base + "/chat/completions";
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.key },
                body: JSON.stringify({
                    model: a.model,
                    messages: [
                        {
                            role: "user",
                            content:
                                "生成 10 条简短的中文夸赞语，用于完成任务时鼓励自己。每条不超过 12 个字，可以带 1 个 emoji，一行一条，不要编号，不要提具体任务内容。"
                        }
                    ],
                    max_tokens: 320,
                    temperature: 0.95
                })
            });
            const j = await res.json();
            const txt = (j?.choices?.[0]?.message?.content || "") as string;
            const items = txt
                .split("\n")
                .map((l) => l.replace(/^[\s\d.、\-*）)]+/, "").trim())
                .filter((l) => l.length > 0 && l.length <= 24)
                .slice(0, 10);
            if (items.length) {
                window.localStorage.setItem("tongyun_ai_praise", JSON.stringify(items));
                poolCount = items.length;
            }
        } catch {
            /* 静默失败 */
        }
        poolLoading = false;
    }

    function num(key: "focusMin" | "breakMin" | "longBreakMin" | "longBreakEvery" | "dailyGoal", min: number, max: number) {
        return (e: Event) => {
            const v = Math.min(max, Math.max(min, Number((e.target as HTMLInputElement).value) || min));
            settings.update((s) => ({ ...s, [key]: v }));
            save("settings");
        };
    }

    function text(key: "weatherCity") {
        return (e: Event) => {
            const v = (e.target as HTMLInputElement).value.trim();
            settings.update((s) => ({ ...s, [key]: v }));
            save("settings");
        };
    }

    function aiField(key: "endpoint" | "key" | "model") {
        return (e: Event) => {
            const v = (e.target as HTMLInputElement).value.trim();
            settings.update((s) => ({ ...s, ai: { ...s.ai, [key]: v } }));
            save("settings");
        };
    }

    function toggleAutoBreak(e: Event) {
        const on = (e.target as HTMLInputElement).checked;
        settings.update((s) => ({ ...s, autoBreak: on }));
        save("settings");
    }

    function onVolume(e: Event) {
        const v = Number((e.target as HTMLInputElement).value);
        settings.update((s) => ({ ...s, noiseVolume: v }));
        noise.setVolume(v);
        save("settings");
    }
</script>

<div class="ty-card">
    <div class="ty-h2">专注</div>

    <div class="ty-field">
        <span class="ty-field-label">番茄时长</span>
        <div class="ty-field-body">
            <input class="ty-input" type="number" min="1" max="180" value={$settings.focusMin} on:change={num("focusMin", 1, 180)} />
        </div>
        <span class="ty-dim">分钟</span>
    </div>

    <div class="ty-field">
        <span class="ty-field-label">短休息</span>
        <div class="ty-field-body">
            <input class="ty-input" type="number" min="1" max="60" value={$settings.breakMin} on:change={num("breakMin", 1, 60)} />
        </div>
        <span class="ty-dim">分钟</span>
    </div>

    <div class="ty-field">
        <span class="ty-field-label">长休息</span>
        <div class="ty-field-body">
            <input class="ty-input" type="number" min="1" max="120" value={$settings.longBreakMin} on:change={num("longBreakMin", 1, 120)} />
        </div>
        <span class="ty-dim">分钟</span>
    </div>

    <div class="ty-field">
        <span class="ty-field-label">长休息间隔</span>
        <div class="ty-field-body">
            <input class="ty-input" type="number" min="2" max="12" value={$settings.longBreakEvery} on:change={num("longBreakEvery", 2, 12)} />
        </div>
        <span class="ty-dim">个番茄</span>
    </div>

    <div class="ty-field">
        <span class="ty-field-label">每日目标</span>
        <div class="ty-field-body">
            <input class="ty-input" type="number" min="1" max="30" value={$settings.dailyGoal} on:change={num("dailyGoal", 1, 30)} />
        </div>
        <span class="ty-dim">个番茄</span>
    </div>

    <div class="ty-field">
        <span class="ty-field-label">自动休息</span>
        <div class="ty-field-body">
            <input type="checkbox" checked={$settings.autoBreak} on:change={toggleAutoBreak} style="accent-color:var(--b3-theme-primary)" />
        </div>
        <span class="ty-dim">专注结束自动进入休息</span>
    </div>
</div>

<div class="ty-card">
    <div class="ty-h2">白噪音</div>
    <div class="ty-field">
        <span class="ty-field-label">默认音量</span>
        <div class="ty-field-body">
            <input type="range" min="0" max="1" step="0.05" value={$settings.noiseVolume} on:input={onVolume} style="width:100%;accent-color:var(--b3-theme-primary)" />
        </div>
    </div>
</div>

<div class="ty-card">
    <div class="ty-h2">首页</div>
    <div class="ty-field">
        <span class="ty-field-label">天气城市</span>
        <div class="ty-field-body">
            <input class="ty-input" placeholder="Beijing / Shanghai / Shenzhen" value={$settings.weatherCity} on:change={text("weatherCity")} />
        </div>
    </div>
    <div class="ty-dim" style="margin-top:4px">用英文城市名或拼音，留空则不显示天气</div>
</div>

<div class="ty-card">
    <div class="ty-h2">AI 寄语</div>
    <div class="ty-field">
        <span class="ty-field-label">接口地址</span>
        <div class="ty-field-body">
            <input class="ty-input" placeholder="https://api.openai.com/v1" value={$settings.ai.endpoint} on:change={aiField("endpoint")} />
        </div>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">API Key</span>
        <div class="ty-field-body">
            <input class="ty-input" type="password" placeholder="sk-..." value={$settings.ai.key} on:change={aiField("key")} />
        </div>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">模型</span>
        <div class="ty-field-body">
            <input class="ty-input" placeholder="gpt-4o-mini" value={$settings.ai.model} on:change={aiField("model")} />
        </div>
    </div>
    <div class="ty-dim" style="margin-top:4px">兼容 OpenAI 接口格式的服务都能用，留空则不启用</div>
</div>

<div class="ty-card">
    <div class="ty-h2">外观</div>
    <div class="ty-field">
        <span class="ty-field-label">深色模式</span>
        <div class="ty-field-body">
            <input type="checkbox" checked={$settings.dark} on:change={toggleDark} style="accent-color:#4d7c5d" />
        </div>
        <span class="ty-dim">手帐风深色纸感</span>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">音效</span>
        <div class="ty-field-body">
            <input type="checkbox" checked={$settings.soundOn} on:change={toggleSound} style="accent-color:#4d7c5d" />
        </div>
        <span class="ty-dim">完成、打卡时的轻提示音</span>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">夸夸模式</span>
        <div class="ty-field-body">
            <input type="checkbox" checked={$settings.praiseOn} on:change={togglePraise} style="accent-color:#4d7c5d" />
        </div>
        <span class="ty-dim">把 AI 生成的文案混进夸夸词库</span>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">夸夸词库</span>
        <div class="ty-field-body ty-dim">
            {poolCount > 0 ? `已有 ${poolCount} 条 AI 文案` : "内置 10 条，可再让 AI 扩一批"}
        </div>
        <button class="ty-btn sm" on:click={genPraisePool} disabled={poolLoading}>
            {poolLoading ? "生成中…" : "生成 10 条"}
        </button>
    </div>
</div>

<div class="ty-card">
    <div class="ty-h2">RSS 订阅</div>
    <div class="ty-dim" style="margin-bottom:10px">
        添加 RSS 地址后，「朝花夕拾 → RSS 阅览室」会拉取文章。留空的源不会请求。
    </div>

    {#if ($settings.rssFeeds || []).length > 0}
        <div class="feeds">
            {#each $settings.rssFeeds as f (f.id)}
                <div class="feed">
                    <span class="fname">{f.name}</span>
                    <span class="furl" title={f.url}>{f.url}</span>
                    <button class="ty-btn sm" on:click={() => removeFeed(f.id)}>移除</button>
                </div>
            {/each}
        </div>
    {/if}

    <div class="ty-row" style="margin-top:10px">
        <input class="ty-input" style="flex:0 0 140px" placeholder="名称（可选）" bind:value={feedName} />
        <input class="ty-input" placeholder="https://example.com/feed.xml" bind:value={feedUrl} />
        <button class="ty-btn primary" on:click={addFeed}>添加</button>
    </div>
</div>

<div class="ty-card">
    <div class="ty-h2">数据</div>
    <div class="ty-field">
        <span class="ty-field-label">任务</span>
        <div class="ty-field-body ty-dim">{$tasks.length} 条</div>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">便签</span>
        <div class="ty-field-body ty-dim">{$stickies.length} 张</div>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">日记</span>
        <div class="ty-field-body ty-dim">{Object.values($diaries).filter((entry) => entry.content.trim()).length} 篇</div>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">番茄记录</span>
        <div class="ty-field-body ty-dim">{$focusRecords.length} 次</div>
    </div>
    <div class="ty-field">
        <span class="ty-field-label">收藏</span>
        <div class="ty-field-body ty-dim">{$favorites.length} 条</div>
    </div>
    <div class="ty-dim" style="margin-top:8px;line-height:1.7">
        数据保存在插件目录 <code>data/storage/petal/Konh-workbench/</code>，
        随思源同步走。备份思源工作空间即可。
    </div>
    <div class="ty-row" style="margin-top:12px;align-items:center;flex-wrap:wrap">
        <button class="ty-btn primary" on:click={downloadBackup} disabled={backupBusy}>导出 JSON 备份</button>
        <label class="ty-dim"><input type="checkbox" bind:checked={includeAiKey} /> 包含 AI API Key（谨慎）</label>
        <label class="ty-btn" class:disabled={backupBusy}>
            导入 JSON 备份
            <input type="file" accept="application/json,.json" on:change={chooseBackup} disabled={backupBusy} style="display:none" />
        </label>
    </div>
    {#if backupMessage}<div class="ty-dim" style="margin-top:8px;color:var(--b3-theme-primary)">{backupMessage}</div>{/if}
    {#if backupError}<div class="ty-dim" style="margin-top:8px;color:#b33">导入失败：{backupError}</div>{/if}
</div>
