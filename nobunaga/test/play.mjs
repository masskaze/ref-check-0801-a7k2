import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const CLAN = process.argv[2] || '武田';
const SEASONS = +(process.argv[3] || 12);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,4).join('\n')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_TUNNEL/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
await page.goto(process.env.GAME_URL || ('file://' + process.cwd() + '/nobunaga/index.html'));
await page.click('#title [data-act="new"]');
for (const c of await page.$$('.clan-chip')) { if ((await c.textContent()).includes(CLAN)) { await c.click(); break; } }
await page.click('#startBtn');
await page.waitForTimeout(400);

async function clearModals(max = 4) {
  for (let i = 0; i < max; i++) {
    if (!(await page.$('#modal.show'))) return;
    const picks = await page.$$('#modalBody .pick');
    if (picks.length) { await picks[0].click(); }
    else {
      const f = await page.$$('#modal.show #modalFoot .btn');
      if (!f.length) return;
      await f[f.length - 1].click();
    }
    await page.waitForTimeout(120);
  }
  if (await page.$('#modal.show')) { await page.click('#modalX'); }
}
async function clickModalLast() {
  await page.waitForSelector('#modal.show', { timeout: 5000 });
  await page.waitForTimeout(120);
  const f = await page.$$('#modal.show #modalFoot .btn');
  await f[f.length - 1].click();
}
async function handleBattle() {
  if (!(await page.$('#battle.show'))) return false;
  await page.click('#btlAuto');
  await clickModalLast();
  await page.waitForTimeout(1800);
  await clearModals(6);
  await page.waitForTimeout(400);
  return true;
}

const SAFE = ['開墾','商業','治水','施し','徴兵','訓練','探索','城普請','技術振興','文化振興','兵糧購入','登用','褒美','茶会','朝廷工作','流言'];
for (let s = 0; s < SEASONS; s++) {
  const mine = await page.evaluate(() => NB.engine.provsOf(NB.engine.getState().playerClan).map(p => p.id));
  for (const pid of mine) {
    await page.evaluate(id => NB.ui.clickProv(id), pid);
    await page.waitForTimeout(60);
    for (let a = 0; a < 3; a++) {
      const acted = await page.evaluate(id => { const p = NB.engine.prov(id); return p.acted >= p.actMax; }, pid);
      if (acted) break;
      const btns = await page.$$('#provPanel .cmd');
      const cands = [];
      for (const b of btns) { const t = await b.textContent(); if (SAFE.includes(t) && !(await b.isDisabled())) cands.push(b); }
      if (!cands.length) break;
      await cands[Math.floor(Math.random()*cands.length)].click();
      await page.waitForTimeout(120);
      // 目標選択モードなら地図から選ぶ
      const tgt = await page.$$('.pv.tgt');
      if (tgt.length) { await tgt[0].click(); await page.waitForTimeout(120); }
      await clearModals();
      await page.waitForTimeout(80);
    }
  }
  // たまに出陣
  if (s % 3 === 2 && !process.env.NOATK) {
    const done = await page.evaluate(() => {
      const E = NB.engine, B = NB.battle, st = E.getState();
      for (const p of E.provsOf(st.playerClan)) {
        if (p.acted >= p.actMax || p.hei < 1500) continue;
        for (const a of p.adj) { if (!B.canAttack(p, E.prov(a))) { NB.ui.shutsujinDialog(p, a); return true; } }
      }
      return false;
    });
    if (done) {
      await page.waitForTimeout(200);
      await clickModalLast();
      await page.waitForTimeout(400);
      await handleBattle();
    }
  }
  await page.click('#endTurnBtn');
  await page.waitForTimeout(150);
  await clearModals(2);
  for (let g = 0; g < 12; g++) {
    await page.waitForTimeout(700);
    if (await handleBattle()) continue;
    const busy = await page.evaluate(() => document.querySelector('#endTurnBtn').disabled);
    if (!busy) break;
  }
  const over = await page.evaluate(() => NB.engine.getState().ended);
  if (over) { console.log('game ended at season', s); break; }
}
const st = await page.evaluate(() => {
  const E = NB.engine, s = E.getState();
  return { year: s.year, season: s.season, provs: E.provsOf(s.playerClan).length, gens: E.gensOf(s.playerClan).length,
           battles: s.history.battles, clans: E.aliveClans().length };
});
console.log(CLAN, JSON.stringify(st));
console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none');
await page.screenshot({ path: 'nobunaga/test/shot-play.png' });
await browser.close();
process.exit(errors.length ? 1 : 0);
