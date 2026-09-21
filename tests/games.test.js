const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const {
  GAME_CATALOG,
  FEATURED_GAMES,
  findGame,
  resolveGameQuery,
  teamMatchesGame,
  filterTeamsByGame,
  gamePath,
  gameNavTitle,
  gameShare,
} = require(path.join(root, 'miniprogram/utils/games.js'));
const { SHARE_COVER } = require(path.join(root, 'miniprogram/utils/share.js'));

test('game catalog resolves slugs, aliases and live team names', () => {
  assert.equal(findGame('cs2').name, 'CS2');
  assert.equal(findGame('CS:GO').slug, 'cs2');
  assert.equal(findGame('三角洲').slug, 'delta');
  assert.equal(findGame('delta-force').slug, 'delta');
  assert.equal(findGame('peace').slug, 'pubg');
  assert.equal(findGame('peace').seoKey, 'peace');
  assert.equal(findGame('王者荣耀').name, '王者荣耀');
  assert.equal(resolveGameQuery({ game: 'wangzhe' }).slug, 'wangzhe');
  assert.equal(resolveGameQuery({ g: 'pubg' }).seoKey, 'peace');
  assert.equal(findGame(''), null);
  assert.equal(findGame('不存在的游戏'), null);
  assert.equal(teamMatchesGame({ gameName: 'CS 2' }, findGame('cs2')), true);
  assert.equal(teamMatchesGame({ gameName: '永劫无间三排' }, findGame('naraka')), true);
  assert.equal(teamMatchesGame({ gameName: '英雄联盟' }, findGame('cs2')), false);
  assert.deepEqual(
    filterTeamsByGame(
      [
        { _id: 'a', gameName: 'CS2' },
        { _id: 'b', gameName: '三角洲行动' },
        { _id: 'c', gameName: 'CSGO' },
      ],
      findGame('cs2')
    ).map((t) => t._id),
    ['a', 'c']
  );
  assert.equal(gamePath('delta'), '/pages/game/game?game=delta');
  assert.equal(gamePath('peace'), '/pages/game/game?game=peace');
  assert.equal(gameNavTitle(findGame('pubg')), '和平精英搭子｜组队找队友');
  assert.equal(gameNavTitle(findGame('wangzhe')), '王者开黑｜王者搭子');
  assert.equal(gameNavTitle(findGame('delta')), '三角洲搭子｜三角洲行动组队');
  assert.equal(gameNavTitle(findGame('valorant')), '瓦搭子｜无畏契约组队');
  const share = gameShare(findGame('wangzhe'));
  assert.equal(share.path, '/pages/game/game?game=wangzhe');
  assert.equal(share.query, 'game=wangzhe');
  assert.equal(share.title, '王者开黑｜王者搭子');
  assert.equal(gameShare(findGame('delta')).title, '三角洲搭子｜三角洲行动组队');
  assert.deepEqual(FEATURED_GAMES.map((g) => g.seoKey), ['wangzhe', 'delta', 'valorant', 'peace']);
  assert.ok(GAME_CATALOG.length >= 6);
});

test('sitemap only indexes the homepage and canonical game= URLs', () => {
  const sitemap = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/sitemap.json'), 'utf8'));
  assert.equal(sitemap.rules[0].action, 'allow');
  assert.equal(sitemap.rules[0].page, 'pages/index/index');
  assert.deepEqual(sitemap.rules[0].params, []);
  assert.equal(sitemap.rules[0].matching, 'exact');
  assert.equal(sitemap.rules[1].action, 'allow');
  assert.equal(sitemap.rules[1].page, 'pages/game/game');
  assert.deepEqual(sitemap.rules[1].params, ['game']);
  assert.equal(sitemap.rules[1].matching, 'exact');
  assert.deepEqual(sitemap.rules.slice(2).map((rule) => [rule.action, rule.page]), [
    ['disallow', 'pages/game/game'],
    ['disallow', '*'],
  ]);

  function sitemapAction(page, params) {
    const names = (params || []).slice().sort();
    for (const rule of sitemap.rules) {
      if (rule.page !== '*' && rule.page !== page) continue;
      if (!Object.prototype.hasOwnProperty.call(rule, 'params')) return rule.action;
      const wanted = (rule.params || []).slice().sort();
      const matching = rule.matching || 'inclusive';
      const hit =
        matching === 'exact'
          ? names.length === wanted.length && names.every((name, i) => name === wanted[i])
          : wanted.every((name) => names.indexOf(name) >= 0);
      if (hit) return rule.action;
    }
    return 'allow';
  }

  assert.equal(sitemapAction('pages/index/index', []), 'allow');
  assert.equal(sitemapAction('pages/game/game', ['game']), 'allow');
  assert.equal(sitemapAction('pages/game/game', ['id']), 'disallow');
  assert.equal(sitemapAction('pages/game/game', ['g']), 'disallow');
  assert.equal(sitemapAction('pages/game/game', ['foo', 'game']), 'disallow');
  assert.equal(sitemapAction('pages/team/detail', ['id']), 'disallow');

  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  assert.equal(appJson.pages[0], 'pages/index/index');
  assert.ok(appJson.pages.includes('pages/game/game'));
  assert.equal(appJson.sitemapLocation, 'sitemap.json');
  assert.match(appJson.window.navigationBarTitleText, /游戏搭子｜开黑找队友/);
  const indexJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.json'), 'utf8'));
  assert.equal(indexJson.navigationBarTitleText, '游戏搭子｜开黑找队友');
  const gameJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/game/game.json'), 'utf8'));
  assert.equal(gameJson.navigationBarTitleText, '游戏搭子｜开黑组队');
});

test('lobby and game pages expose crawlable game landing links', () => {
  const indexWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const gameWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/game/game.wxml'), 'utf8');
  const gameJs = fs.readFileSync(path.join(root, 'miniprogram/pages/game/game.js'), 'utf8');
  assert.match(indexWxml, /找游戏搭子，一起开黑/);
  assert.match(indexWxml, /王者开黑、三角洲搭子、瓦搭子、和平精英搭子/);
  assert.match(indexWxml, /url="\/pages\/game\/game\?game=\{\{item\.seoKey\}\}"/);
  assert.doesNotMatch(indexWxml, /\/pages\/game\/game\?(g|id)=/);
  assert.doesNotMatch(indexWxml, /display:\s*none|opacity:\s*0/i);
  assert.match(gameWxml, /class="seo-header"/);
  assert.match(gameWxml, /\{\{seoHeading\}\}/);
  assert.match(gameWxml, /\{\{seoDescription\}\}/);
  assert.match(gameWxml, /暂时还没有队伍，发布一个组队邀请吧。/);
  assert.match(gameWxml, /url="\/pages\/game\/game\?game=\{\{item\.seoKey\}\}"/);
  assert.doesNotMatch(gameWxml, /\/pages\/game\/game\?(g|id)=/);
  assert.doesNotMatch(gameJs, /switchTab\(\{\s*url:\s*['"]\/pages\/mine/);
  assert.doesNotMatch(gameJs, /NEED_PROFILE/);
});

test('game landing page shares the current game and prefills publish', async () => {
  let page;
  const titles = [];
  const tabs = [];
  const app = { globalData: {} };
  const calls = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/game/game.js'), 'utf8'), {
    Page: (value) => { page = value; },
    getApp: () => app,
    require: (name) => {
      if (name.endsWith('/cloud')) {
        return {
          callTeam: async (type, data) => {
            calls.push([type, data]);
            return {
              list: [
                { _id: 'other', gameName: 'CS2', createdAt: 2 },
                { _id: 'hit', gameName: '三角洲行动', createdAt: 1 },
              ],
              hasMore: false,
              nextOffset: 2,
            };
          },
          showError() {},
        };
      }
      return require(path.resolve(root, 'miniprogram/pages/game', name));
    },
    wx: {
      setNavigationBarTitle: ({ title }) => titles.push(title),
      switchTab: ({ url }) => tabs.push(url),
      onCopyUrl() {},
      offCopyUrl() {},
    },
  });
  page.setData = (patch) => Object.assign(page.data, patch);
  page.onLoad({ g: 'delta' });
  assert.equal(page.data.game.slug, 'delta');
  assert.equal(page.data.gameKey, 'delta');
  assert.equal(titles[0], '三角洲搭子｜三角洲行动组队');
  assert.equal(page.data.seoHeading, '找三角洲搭子');
  page.onLoad({ game: 'peace' });
  assert.equal(page.data.game.slug, 'pubg');
  assert.equal(page.data.gameKey, 'peace');
  assert.equal(page.data.seoTitle, '和平精英搭子｜组队找队友');
  page.onLoad({ id: 'delta-force' });
  assert.equal(page.data.game.slug, 'delta');
  assert.equal(page.data.seoHeading, '找三角洲搭子');
  assert.equal(page.onShareAppMessage().title, '三角洲搭子｜三角洲行动组队');
  assert.equal(page.onShareAppMessage().path, '/pages/game/game?game=delta');
  assert.equal(page.onShareTimeline().query, 'game=delta');
  assert.equal(page.onShareTimeline().path, undefined);
  assert.equal(page.onShareAppMessage().imageUrl, SHARE_COVER);
  assert.equal(page.onShareTimeline().imageUrl, SHARE_COVER);
  await page.loadList();
  assert.deepEqual(calls.map((item) => item[0]), ['listTeams']);
  assert.equal(page.data.filtered.length, 1);
  assert.equal(page.data.filtered[0]._id, 'hit');
  page.goPublish();
  assert.equal(app.globalData.prefillGame.name, '三角洲行动');
  assert.equal(app.globalData.prefillGame.platform, 'Steam');
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0], '/pages/publish/publish');
});

test('game page keeps SEO copy when the team list request fails', async () => {
  let page;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/game/game.js'), 'utf8'), {
    Page: (value) => { page = value; },
    getApp: () => ({ globalData: {} }),
    require: (name) => {
      if (name.endsWith('/cloud')) {
        return {
          callTeam: async () => {
            throw new Error('network');
          },
          showError() {},
        };
      }
      return require(path.resolve(root, 'miniprogram/pages/game', name));
    },
    wx: {
      setNavigationBarTitle() {},
      onCopyUrl() {},
      offCopyUrl() {},
    },
  });
  page.setData = (patch) => Object.assign(page.data, patch);
  page.onLoad({ game: 'wangzhe' });
  await page.loadList();
  assert.equal(page.data.listError, true);
  assert.equal(page.data.seoHeading, '王者开黑找搭子');
  assert.equal(
    page.data.seoDescription,
    '找王者搭子，一起开黑。支持单双排、五排组队，快速找到一起玩的王者队友。'
  );
  assert.equal(page.data.filtered.length, 0);
});
