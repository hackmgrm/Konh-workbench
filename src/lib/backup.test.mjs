import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const result = await build({ entryPoints: [fileURLToPath(new URL('./backup.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
const backup = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));

test('export excludes AI key by default and validates round trip', () => {
    const parsed = backup.parseBackup(backup.exportBackup());
    assert.equal(parsed.settings.ai.key, '');
    assert.deepEqual(Object.keys(parsed).sort(), ['categories', 'countdowns', 'diaries', 'favorites', 'focus', 'habits', 'settings', 'stickies', 'tasks'].sort());
});

test('task project survives backup and legacy tasks without project remain valid', () => {
    const raw = JSON.parse(backup.exportBackup());
    const task = { id: 'task', title: '任务', note: '', done: false, important: false, urgent: false,
        created: 1, doneAt: 0, due: '', start: '', repeat: 'none', url: '', category: 'none',
        reminder: 0, tags: [], subtasks: [], project: '项目甲' };
    raw.data.tasks = [task];
    assert.equal(backup.parseBackup(JSON.stringify(raw)).tasks[0].project, '项目甲');
    delete task.project;
    assert.equal(backup.parseBackup(JSON.stringify(raw)).tasks[0].project, undefined);
});

test('invalid format and malformed records are rejected', () => {
    assert.throws(() => backup.parseBackup('{'));
    assert.throws(() => backup.parseBackup('{"format":"other"}'));
    const raw = JSON.parse(backup.exportBackup());
    raw.data.diaries = { '2026-01-01': { content: null } };
    assert.throws(() => backup.parseBackup(JSON.stringify(raw)), /diaries/);
    assert.throws(() => backup.parseBackup(' '.repeat(20 * 1024 * 1024 + 1)), /20 MB/);
});

test('merge preserves existing IDs and diary days, including duplicates in backup', () => {
    const current = backup.parseBackup(backup.exportBackup());
    const incoming = backup.parseBackup(backup.exportBackup());
    const entry = { content: 'local', mood: -1, tags: [], aiComment: '', updatedAt: 0 };
    current.diaries['2026-01-01'] = entry;
    incoming.diaries['2026-01-01'] = { ...entry, content: 'remote' };
    incoming.diaries['2026-01-02'] = { ...entry, content: 'new' };
    current.categories = [{ id: 'x', name: 'local', color: '' }];
    incoming.categories = [{ id: 'x', name: 'remote', color: '' }, { id: 'y', name: 'first', color: '' }, { id: 'y', name: 'second', color: '' }];
    current.settings.ai.key = 'secret';
    const merged = backup.mergeBackup(current, incoming);
    assert.deepEqual(merged.categories.map(x => x.name), ['local', 'first']);
    assert.equal(merged.diaries['2026-01-01'].content, 'local');
    assert.equal(merged.diaries['2026-01-02'].content, 'new');
    assert.equal(merged.settings.ai.key, 'secret');
});
