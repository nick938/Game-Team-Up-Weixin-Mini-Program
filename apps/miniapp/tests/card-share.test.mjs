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
