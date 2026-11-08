import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');

test('cloud groups update labels and selection reactively; old requests and failures preserve saved catalog', async () => {
  let resolve;
  const h = harness({
    callTeam: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const options = h.load('utils/profile-options');
  const pending = options.loadGroupOptions(true);
  const newer = { revision: 2, groups: [{ value: 'new', label: '新群', enabled: true }] };
  options.applyGroupCatalog(newer);
  resolve({ revision: 1, groups: [] });
  await pending;
  assert.deepEqual([...options.groupLabels(['new'])], ['新群']);
  options.applyGroupCatalog({
    revision: 3,
    groups: [{ ...newer.groups[0], label: '已改名', enabled: false }],
  });
  assert.equal(options.GROUP_OPTIONS.value.length, 0);
  assert.deepEqual([...options.groupLabels(['new'])], ['已改名']);
  const failed = harness({
    callTeam: async () => {
      throw new Error('offline');
    },
  });
  const cached = failed.load('utils/profile-options');
  cached.applyGroupCatalog(newer);
  await assert.rejects(cached.loadGroupOptions(true), /offline/);
  assert.deepEqual([...cached.groupLabels(['new'])], ['新群']);
});

test('admin form creates a stable group and retains draft on save errors', async () => {
  let fail = false;
  const h = harness({
    callTeam: async (action, input) => {
      if (action === 'adminGroups') return { groups: [], revision: 0 };
      if (fail) throw new Error('群组已被其他管理员修改，请刷新后重试');
      return { groups: [input.group], revision: 1 };
    },
  });
  const page = h.page('components/admin-groups/index');
  await page.hooks.mounted();
  page.edit();
  page.form.label = '新建群组';
  await page.submit();
  const saved = h.calls.find((call) => call.action === 'adminSaveGroup').input.group;
  assert.match(saved.value, /^group-/);
  assert.equal(saved.revision, 0);
  assert.equal(page.view.editing, false);
  page.edit(page.view.groups[0]);
  page.form.label = '新名称';
  fail = true;
  await page.submit();
  assert.equal(page.view.editing, true);
  assert.equal(page.form.label, '新名称');
  assert.equal(page.view.groups[0].label, '新建群组');
});
