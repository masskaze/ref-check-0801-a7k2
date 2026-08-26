import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const url = 'file://' + process.cwd() + '/nobunaga/index.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(url);
await page.waitForTimeout(300);

// title -> setup
await page.click('#title [data-act="new"]');
await page.waitForSelector('#setup.show');
// pick 織田
const chips = await page.$$('.clan-chip');
let picked = false;
for (const c of chips) {
  const t = await c.textContent();
  if (t.includes('織田')) { await c.click(); picked = true; break; }
}
console.log('clan picked:', picked);
await page.click('#startBtn');
await page.waitForSelector('#game.show');
await page.waitForTimeout(400);
console.log('provinces rendered:', (await page.$$('.pv')).length);
console.log('top stats:', (await page.textContent('#tbStats')).replace(/\s+/g,' ').trim());
console.log('side panel title:', await page.textContent('#provPanel .ph h3'));
await page.screenshot({ path: 'nobunaga/test/shot-map.png' });

// run a command: 開墾
const cmds = await page.$$('#provPanel .cmd');
console.log('commands available:', cmds.length);
await cmds[0].click();
await page.waitForSelector('#modal.show');
await page.waitForTimeout(150);
await page.screenshot({ path: 'nobunaga/test/shot-cmd.png' });
await page.click('#modalBody .pick');
await page.waitForTimeout(200);
console.log('toast:', await page.textContent('#toast'));

// end season a few times
for (let i = 0; i < 3; i++) {
  await page.click('#endTurnBtn');
  const conf = await page.$('#modal.show');
  if (conf) { const btns = await page.$$('#modalFoot .btn'); await btns[btns.length-1].click(); }
  await page.waitForTimeout(900);
  const battle = await page.$('#battle.show');
  if (battle) { console.log('defense battle triggered at season', i); break; }
}
await page.waitForTimeout(400);
console.log('after turns:', (await page.textContent('#tbYear')) + (await page.textContent('#tbSeason')));
await page.screenshot({ path: 'nobunaga/test/shot-after.png' });
console.log('ERRORS:', errors.length ? errors.slice(0,10) : 'none');
await browser.close();
