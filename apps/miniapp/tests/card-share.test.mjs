import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const team = {
  _id: 'target',
  gameName: '机械狂欢',
  startAt: Date.now() + 3600000,
  endAt: Date.now() + 7200000,
  timeText: '今晚 20:30–22:30',
  memberCount: 2,
  capacity: 4,
  roomNo: 'private-room',
  roomPwd: 'secret',
};
for (const page of ['pages/index/index', 'pages/game/game', 'pages/mine/mine', 'pages/friday/friday']) {
  test(`${page} shares the clicked card and preserves menu sharing`, () => {
    const h = harness();
    const rendered = h.page(page);
    const { registerCardShare } = h.load('utils/card-share');
    const card = registerCardShare(() => team);
    const payload = rendered.hooks.onShareAppMessage({
      from: 'button',
      target: { id: card.buttonId },
    });
    assert.ok(payload.path.includes('/pages/team/detail?'));
    assert.ok(payload.path.includes('id=target'));
    assert.ok(payload.path.includes('from=share'));
    assert.ok(payload.title.includes('机械狂欢'));
    assert.ok(payload.title.includes('20:30–22:30'));
    assert.ok(payload.title.includes('2/4'));
    assert.ok(payload.imageUrl);
    assert.ok(!JSON.stringify(payload).includes('private-room'));
    assert.ok(!JSON.stringify(payload).includes('secret'));

    const menu = rendered.hooks.onShareAppMessage({ from: 'menu' });
    assert.ok(!menu.path.includes('id=target'));
    const other = rendered.hooks.onShareAppMessage({ from: 'button', target: { id: 'unrelated' } });
    assert.ok(!other.path.includes('id=target'));
    // Sharing remains tied to the source without a preceding click, and uses fresh data.
    const updated = { ...team, _id: 'second', memberCount: 3 };
    const second = registerCardShare(() => updated);
    const secondPayload = rendered.hooks.onShareAppMessage({
      from: 'button',
      target: { id: second.buttonId },
    });
    assert.ok(secondPayload.path.includes('id=second'));
    assert.ok(secondPayload.title.includes('3/4'));
    updated.memberCount = 4;
    assert.ok(
      rendered.hooks
        .onShareAppMessage({ from: 'button', target: { id: second.buttonId } })
        .title.includes('4/4'),
    );
    assert.ok(
      rendered.hooks
        .onShareAppMessage({ from: 'button', target: { id: card.buttonId } })
        .path.includes('id=target'),
    );
    second.dispose();
    assert.ok(
      !rendered.hooks
        .onShareAppMessage({ from: 'button', target: { id: second.buttonId } })
        .path.includes('id=second'),
    );
    card.dispose();
  });
}

function canvasHost({ failExport = false } = {}) {
  const drawn = [];
  const exports = [];
  const context = new Proxy(
    {},
    {
      get(_, key) {
        if (key === 'measureText') return (text) => ({ width: String(text).length * 8 });
        if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (key === 'fillText') return (text) => drawn.push(String(text));
        return () => {};
      },
    },
  );
  const canvas = { getContext: () => context };
  return {
    drawn,
    exports,
    platform: {
      getWindowInfo: () => ({ pixelRatio: 2 }),
      createSelectorQuery() {
        return {
          select(id) {
            assert.equal(id, '#cardShareCover');
            return this;
          },
          fields() {
            return this;
          },
          exec(callback) {
            callback([{ node: canvas }]);
          },
        };
      },
      canvasToTempFilePath(options) {
        assert.equal(options.canvas, canvas);
        assert.equal(options.canvasId, 'cardShareCover');
        exports.push(options);
        if (failExport) options.fail(new Error('export failed'));
        else options.success({ tempFilePath: `wxfile://car-${exports.length}.jpg` });
      },
    },
  };
}

for (const page of ['pages/index/index', 'pages/game/game', 'pages/mine/mine', 'pages/friday/friday']) {
  test(`${page} supplies the selected car information image through the native share promise`, async () => {
    const host = canvasHost();
    const h = harness({ platform: host.platform });
    const rendered = h.page(page);
    let current = { ...team };
    const card = h.load('utils/card-share').registerCardShare(() => current);
    const payload = rendered.hooks.onShareAppMessage({ from: 'button', target: { id: card.buttonId } });
    // A refresh after sharing starts must not replace the selected vehicle's image.
    current = { ...team, _id: 'another', gameName: '其他游戏' };
    const resolved = await payload.promise;
    assert.equal(resolved.path, payload.path);
    assert.equal(resolved.title, payload.title);
    assert.equal(resolved.imageUrl, 'wxfile://car-1.jpg');
    assert.ok(host.drawn.includes('机械狂欢'));
    assert.ok(host.drawn.includes('2/4'));
    assert.ok(!host.drawn.includes('其他游戏'));
    assert.ok(!host.drawn.includes('private-room'));
    assert.ok(!host.drawn.includes('secret'));
    const next = rendered.hooks.onShareAppMessage({ from: 'button', target: { id: card.buttonId } });
    assert.equal((await next.promise).imageUrl, 'wxfile://car-2.jpg');
    assert.ok(host.drawn.includes('其他游戏'));
    assert.equal(rendered.hooks.onShareAppMessage({ from: 'menu' }).promise, undefined);
    card.dispose();
  });
}

test('cover export failure preserves the car link and does not prevent later shares', async () => {
  const host = canvasHost({ failExport: true });
  const h = harness({ platform: host.platform });
  const page = h.page('pages/index/index');
  const card = h.load('utils/card-share').registerCardShare(() => team);
  for (let i = 0; i < 2; i++) {
    const payload = page.hooks.onShareAppMessage({ from: 'button', target: { id: card.buttonId } });
    const resolved = await payload.promise;
    assert.equal(resolved.imageUrl, payload.imageUrl);
    assert.equal(resolved.path, payload.path);
    assert.ok(resolved.path.includes('id=target'));
  }
  assert.equal(host.exports.length, 2);
  card.dispose();
});
