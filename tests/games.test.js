const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
} = require('./support/miniapp.cjs').harness().load('utils/games');
const { SHARE_COVER } = require('./support/miniapp.cjs').harness().load('utils/share');

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
  const sitemap = JSON.parse(fs.readFileSync(path.join(root, 'apps/miniapp/src/static/sitemap.json'), 'utf8'));
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

});
