import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
await page.goto('file://' + process.cwd() + '/nobunaga/index.html');
await page.click('#title [data-act="new"]');
for (const c of await page.$$('.clan-chip')) { if ((await c.textContent()).includes('織田')) { await c.click(); break; } }
await page.click('#startBtn');
await page.waitForTimeout(400);
await page.screenshot({ path: 'nobunaga/test/shot-panel.png', clip:{x:1100,y:40,width:340,height:860} });

// 出陣
const btns = await page.$$('#provPanel .cmd');
for (const b of btns) { if ((await b.textContent()) === '出陣') { await b.click(); break; } }
await page.waitForTimeout(200);
// target province highlighted; click 美濃
const pv = await page.$$('.pv.tgt');
console.log('attack targets:', pv.length);
for (const p of pv) { if ((await p.textContent()).includes('美濃')) { await p.click(); break; } }
await page.waitForSelector('#modal.show');
await page.waitForTimeout(200);
await page.screenshot({ path: 'nobunaga/test/shot-shutsujin.png' });
const foot = await page.$$('#modalFoot .btn');
await foot[foot.length-1].click();
await page.waitForSelector('#battle.show');
await page.waitForTimeout(500);
console.log('units on field:', (await page.$$('.bu')).length);
await page.screenshot({ path: 'nobunaga/test/shot-battle.png' });
// select a unit and move
const us = await page.$$('.bu.s0');
await us[0].click();
await page.waitForTimeout(200);
console.log('reachable cells:', (await page.$$('.bc.mv')).length);
await page.screenshot({ path: 'nobunaga/test/shot-battle-sel.png' });
const mv = await page.$$('.bc.mv');
await mv[Math.floor(mv.length/2)].click();
await page.waitForTimeout(300);
// auto-run the rest
await page.click('#btlAuto');
await page.waitForTimeout(200);
const f2 = await page.$$('#modalFoot .btn'); await f2[f2.length-1].click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'nobunaga/test/shot-battle-end.png' });
const title = await page.textContent('#modalTitle');
console.log('battle result modal:', title);
const f3 = await page.$$('#modalFoot .btn'); await f3[f3.length-1].click();
await page.waitForTimeout(600);
// captives dialog may appear
let guard=0;
while (await page.$('#modal.show') && guard++<5) { const f = await page.$$('#modalFoot .btn'); await f[0].click(); await page.waitForTimeout(400); }
console.log('after battle stats:', (await page.textContent('#tbStats')).replace(/\s+/g,' ').trim());
await page.screenshot({ path: 'nobunaga/test/shot-after-battle.png' });
console.log('ERRORS:', errors.length ? errors.slice(0,6) : 'none');
await browser.close();
