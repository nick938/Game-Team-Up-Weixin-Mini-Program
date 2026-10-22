const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./support/miniapp.cjs');
function editor({ uploadFails = false } = {}) {
  const uploads = [], saves = [];
  const h = harness({
    store: { user: { nickName: '玩家', avatarUrl: 'https://images.example/old.png', avatarFileID: 'cloud://env/old.png' } },
    uploadAvatar: async path => { uploads.push(path); if (uploadFails) throw new Error('头像上传失败'); return 'cloud://env/new.png'; },
    callTeam: async (action, input) => { saves.push(input); return { user: { ...input, avatarFileID: input.avatarUrl, avatarUrl: 'https://images.example/new.png' } }; },
  });
  const page = h.page('components/profile-gate/index', { show: true });
  return { ...h, page, uploads, saves };
}
test('replacing an avatar uploads the newly selected image instead of reusing the old fileID', async () => {
  const h = editor(); h.page.selectPath('wxfile://new.png'); await h.page.save();
  assert.deepEqual(h.uploads, ['wxfile://new.png']);
  assert.equal(h.saves[0].avatarUrl, 'cloud://env/new.png');
  assert.equal(h.store.user.avatarUrl, 'https://images.example/new.png');
  assert.equal(h.emitted[0].name, 'done');
});
test('editing a nickname retains its cloud fileID', async () => {
  const h = editor(); await h.page.save();
  assert.equal(h.uploads.length, 0); assert.equal(h.saves[0].avatarUrl, 'cloud://env/old.png');
});
test('failed avatar upload keeps the editor open without reporting success', async () => {
  const h = editor({ uploadFails: true }); h.page.selectPath('wxfile://new.png'); await h.page.save();
  assert.equal(h.saves.length, 0); assert.equal(h.emitted.length, 0);
  assert.deepEqual(h.toasts, ['头像上传失败']); assert.equal(h.page.view.saving, false);
});
