const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function editor({ uploadFails = false } = {}) {
  const uploads = [], saves = [], errors = [], events = [];
  const app = { globalData: {} };
  let config;
  const context = {
    Component(value) { config = value; },
    getApp: () => app,
    wx: {
      showLoading() {}, hideLoading() {}, showToast() {},
      cloud: { uploadFile(options) {
        uploads.push(options.filePath);
        if (uploadFails) options.fail({ errMsg: '头像上传失败' });
        else options.success({ fileID: 'cloud://env/new.png' });
      } },
    },
    require: () => ({
      async callTeam(type, payload) {
        saves.push({ type, ...payload });
        return { user: { ...payload, avatarFileID: payload.avatarUrl, avatarUrl: 'https://images.example/new.png' } };
      },
      showError(error) { errors.push(error.message); },
    }),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../miniprogram/components/profile-gate/index.js'), 'utf8'), context);
  const instance = {
    ...config.methods,
    data: { ...config.data, nickName: '玩家', avatarUrl: 'https://images.example/old.png', avatarFileID: 'cloud://env/old.png' },
    setData(value) { Object.assign(this.data, value); },
    triggerEvent(name, data) { events.push({ name, data }); },
  };
  return { instance, uploads, saves, errors, events, app };
}

test('replacing an existing avatar uploads the selected image instead of reusing old fileID', async () => {
  const state = editor();
  state.instance.onChooseAvatar({ detail: { avatarUrl: 'wxfile://new.png' } });
  await state.instance.onSave();
  assert.deepEqual(state.uploads, ['wxfile://new.png']);
  assert.equal(state.saves[0].avatarUrl, 'cloud://env/new.png');
  assert.equal(state.app.globalData.user.avatarUrl, 'https://images.example/new.png');
  assert.equal(state.events[0].name, 'done');
});

test('editing a nickname retains fileID instead of persisting its display URL', async () => {
  const state = editor();
  await state.instance.onSave();
  assert.equal(state.uploads.length, 0);
  assert.equal(state.saves[0].avatarUrl, 'cloud://env/old.png');
});

test('failed avatar upload keeps the editor open and does not report a successful save', async () => {
  const state = editor({ uploadFails: true });
  state.instance.onChooseAvatar({ detail: { avatarUrl: 'wxfile://new.png' } });
  await state.instance.onSave();
  assert.equal(state.saves.length, 0);
  assert.equal(state.events.length, 0);
  assert.deepEqual(state.errors, ['头像上传失败']);
  assert.equal(state.instance.data.saving, false);
});
