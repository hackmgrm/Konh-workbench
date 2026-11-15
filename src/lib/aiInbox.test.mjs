import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const result = await build({ entryPoints: [fileURLToPath(new URL('./aiInbox.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
const { validateInboxTasks, inboxToTask, extractInboxTasks } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
const item = { title: '任务', description: '背景', notes: '备注', dueDate: '2024-02-29', dueTime: '15:30', category: 'urgent-important' };

test('严格校验模型字段、真实日期和时间', () => {
    assert.equal(validateInboxTasks([item]).length, 1);
    for (const patch of [{ dueDate: '2023-02-29' }, { dueDate: '2024-04-31' }, { dueDate: '0000-01-01' }, { dueTime: '24:00' }, { dueDate: '' }, { title: ' ' }, { category: 'urgent' }, { notes: null }]) {
        assert.throws(() => validateInboxTasks([{ ...item, ...patch }]));
    }
    assert.throws(() => validateInboxTasks({}));
    assert.deepEqual(validateInboxTasks([]), []);
});

test('映射象限及截止时间到现有任务结构', () => {
    const t = inboxToTask(item, 'id');
    assert.equal(t.important, true); assert.equal(t.urgent, true);
    assert.equal(t.due, '2024-02-29'); assert.match(t.note, /15:30/);
    assert.equal(inboxToTask({ ...item, category: 'important-not-urgent' }, 'x').urgent, false);
});

test('OpenAI 兼容请求、错误及响应校验', async () => {
    const old = globalThis.fetch;
    try {
        let calls = 0;
        globalThis.fetch = async (url, options) => {
            calls++; assert.equal(url, 'https://example.com/v1/chat/completions');
            assert.equal(options.headers.Authorization, 'Bearer secret');
            assert.equal(JSON.parse(options.body).model, 'model');
            return new Response(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify([item]) + '\n```' } }] }), { status: 200 });
        };
        const cfg = { endpoint: 'https://example.com/v1/', key: 'secret', model: 'model' };
        assert.equal((await extractInboxTasks(cfg, '文本'))[0].title, '任务');
        await assert.rejects(extractInboxTasks({ ...cfg, endpoint: 'file:///tmp/test' }, 'x'));
        assert.equal(calls, 1);
        globalThis.fetch = async () => { throw new TypeError('failed'); };
        await assert.rejects(extractInboxTasks(cfg, 'x'), /CORS/);
        globalThis.fetch = async () => new Response('', { status: 401 });
        await assert.rejects(extractInboxTasks(cfg, 'x'), /401/);
        globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '[]' } }] }));
        await assert.rejects(extractInboxTasks(cfg, 'x'), /截断/);
    } finally { globalThis.fetch = old; }
});
