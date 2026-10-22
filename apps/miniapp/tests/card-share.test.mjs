import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const team = {
  _id: 'target',
  gameName: '机械狂欢',
  startAt: new Date(Date.now() + 86400000).setHours(20, 30, 0, 0),
  endAt: new Date(Date.now() + 86400000).setHours(22, 30, 0, 0),
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
      target: { dataset: { cardShareId: card.buttonId } },
    });
    assert.ok(payload.path.includes('/pages/team/detail?'));
    assert.ok(payload.path.includes('id=target'));
    assert.ok(payload.path.includes('from=share'));
    assert.ok(payload.title.includes('机械狂欢'));
    assert.ok(payload.title.includes('20:30'));
    assert.ok(payload.title.includes('还差 2 人'));
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
    assert.ok(secondPayload.title.includes('还差 1 人'));
    updated.memberCount = 4;
    assert.ok(
      rendered.hooks
        .onShareAppMessage({ from: 'button', target: { id: second.buttonId } })
        .title.includes('已满员'),
    );
    assert.ok(
      rendered.hooks
        .onShareAppMessage({ from: 'button', target: { dataset: { cardShareId: card.buttonId } } })
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

function canvasHost({ failExport = false, canvasId = 'cardShareCover' } = {}) {
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
            assert.equal(id, '#' + canvasId);
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
        assert.equal(options.canvasId, canvasId);
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
    const payload = rendered.hooks.onShareAppMessage({
      from: 'button',
      target: { dataset: { cardShareId: card.buttonId } },
    });
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
    const next = rendered.hooks.onShareAppMessage({
      from: 'button',
      target: { dataset: { cardShareId: card.buttonId } },
    });
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
    const payload = page.hooks.onShareAppMessage({
      from: 'button',
      target: { dataset: { cardShareId: card.buttonId } },
    });
    const resolved = await payload.promise;
    assert.equal(resolved.imageUrl, payload.imageUrl);
    assert.equal(resolved.path, payload.path);
    assert.ok(resolved.path.includes('id=target'));
  }
  assert.equal(host.exports.length, 2);
  card.dispose();
});

test('list and detail share the same vehicle invitation title and destination', () => {
  const h = harness();
  const list = h.page('pages/index/index');
  const detail = h.page('pages/team/detail');
  detail.state.teamId = team._id;
  detail.state.team = team;
  const card = h.load('utils/card-share').registerCardShare(() => team);
  const shared = list.hooks.onShareAppMessage({
    from: 'button',
    target: { dataset: { cardShareId: card.buttonId } },
  });
  const expected = detail.hooks.onShareAppMessage();
  assert.equal(shared.title, expected.title);
  assert.equal(shared.path, expected.path);
  assert.ok(shared.title.startsWith('开黑星球｜机械狂欢 还差 2 人'));
  card.dispose();
});

// Page selectors cannot reach canvas nodes hidden behind a custom component's
// slot boundary. Verify actual Vue template ownership, beyond mocked selectors.
for (const page of ['index/index', 'game/game', 'mine/mine', 'friday/friday', 'team/detail']) {
  test(`${page} owns its share canvas outside custom component slots`, () => {
    const { readFileSync } = require('node:fs');
    const { parse, compileTemplate } = require('../../../apps/miniapp/node_modules/@vue/compiler-sfc');
    const filename = fileURLToPath(new URL(`../src/pages/${page}.vue`, import.meta.url));
    const { descriptor } = parse(readFileSync(filename, 'utf8'));
    const { ast } = compileTemplate({ source: descriptor.template.content, filename, id: 'test' });
    const canvases = [];
    function visit(node, ancestors = []) {
      if (node.tag === 'canvas') canvases.push({ node, ancestors });
      for (const branch of node.branches || []) visit(branch, ancestors);
      for (const child of node.children || []) visit(child, node.tag ? [...ancestors, node.tag] : ancestors);
    }
    visit(ast);
    assert.equal(canvases.length, 1);
    assert.ok(
      canvases[0].ancestors.every((tag) => !tag.includes('-')),
      JSON.stringify(canvases[0].ancestors),
    );
  });
}

test('detail shares the vehicle image even when its initial cover has not finished preparing', async () => {
  const host = canvasHost({ canvasId: 'shareCover' });
  const h = harness({ platform: host.platform });
  const page = h.page('pages/team/detail');
  page.state.teamId = team._id;
  page.state.team = team;
  const payload = page.hooks.onShareAppMessage();
  const resolved = await payload.promise;
  assert.equal(resolved.imageUrl, 'wxfile://car-1.jpg');
  assert.equal(resolved.path, payload.path);
  assert.equal(resolved.title, payload.title);
  assert.ok(host.drawn.includes('缺人'));
  assert.ok(host.drawn.includes('机械狂欢'));
  assert.ok(host.drawn.includes('2/4'));
});
