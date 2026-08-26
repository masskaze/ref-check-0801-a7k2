/* データとエンジンの自動検査（node test/engine.test.mjs） */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const base = new URL('../js/', import.meta.url).pathname;
require(base + 'data.js');
require(base + 'engine.js');
require(base + 'commands.js');
require(base + 'battle.js');
require(base + 'ai.js');

const NB = globalThis.NB, E = NB.engine, C = NB.cmd, B = NB.battle, AI = NB.ai, D = NB.DATA;
let fails = 0, checks = 0;
function ok(cond, name, extra) {
  checks++;
  if (!cond) { fails++; console.log('  NG  ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n■ ' + t); }

/* ---------------- データ ---------------- */
section('データ');
const gens = D.generalTable.trim().split('\n').map(l => l.split('|'));
ok(gens.every(r => r.length === 11), '武将データの列数が揃っている');
ok(new Set(gens.map(r => r[0])).size === gens.length, '武将名に重複がない');
ok(gens.every(r => r.slice(1, 8).every(v => +v >= 1 && +v <= 100)), '能力値が1〜100');
ok(gens.every(r => +r[8] < +r[9]), '生年 < 没年');
const pnames = new Set(D.provinces.map(p => p.name));
ok(pnames.size === D.provinces.length, '国名に重複がない');
let asym = [];
D.provinces.forEach(p => p.adj.forEach(a => {
  const n = a.replace('~', ''), q = D.provinces.find(x => x.name === n);
  if (!q || !q.adj.some(b => b.replace('~', '') === p.name)) asym.push(p.name + '-' + n);
}));
ok(asym.length === 0, '隣接関係が相互になっている', asym.join(','));
const coords = new Set(D.provinces.map(p => p.x + ',' + p.y));
ok(coords.size === D.provinces.length, 'マップ座標が重複しない');
D.scenarios.forEach(sc => {
  const used = new Set(), pu = new Set();
  let dup = [];
  sc.clans.forEach(c => [c.lord].concat(c.men).forEach(m => { if (used.has(m)) dup.push(m); used.add(m); }));
  sc.free.forEach(f => { if (used.has(f[0])) dup.push(f[0]); used.add(f[0]); });
  sc.clans.forEach(c => c.provs.forEach(v => { if (pu.has(v)) dup.push(v); pu.add(v); }));
  ok(dup.length === 0, sc.id + '：武将・国の二重配置がない', dup.join(','));
});

/* ---------------- 初期化 ---------------- */
section('シナリオ初期化');
for (const sc of D.scenarios) {
  const st = E.newGame(sc.id, sc.clans[0].name, 1234);
  const badLord = st.clans.filter(c => !c.dead && (!E.gen(c.lordId) || E.gen(c.lordId).status !== 'active'));
  ok(badLord.length === 0, sc.id + '：全ての家に生きた当主がいる', badLord.map(c => c.name).join(','));
  const noGarrison = st.provinces.filter(p => p.owner != null && !E.gensIn(p.id).filter(g => g.clanId === p.owner).length);
  ok(noGarrison.length === 0, sc.id + '：全ての領国に武将がいる', noGarrison.map(p => p.name).join(','));
  ok(st.provinces.every(p => p.owner == null || p.hei > 0), sc.id + '：領国に兵がいる');
  ok(st.generals.filter(g => g.status === 'active').length > 100, sc.id + '：稼働武将が十分いる');
}

/* ---------------- コマンド ---------------- */
section('コマンド');
{
  const st = E.newGame('s1560', '織田', 77);
  const p = E.provByName('尾張'), g = E.genByName('織田信長');
  const koku0 = p.koku; p.gold = 99999; p.acted = 0; p.actMax = 99;
  ok(C.kaikon(p, g).ok && p.koku > koku0, '開墾で石高が上がる');
  const shou0 = p.shou; ok(C.shogyo(p, g).ok && p.shou > shou0, '商業で商業が上がる');
  const hei0 = p.hei; ok(C.chohei(p, g, 500).ok && p.hei > hei0, '徴兵で兵が増える');
  const gun0 = p.guns; ok(C.buygun(p, g, 50).ok && p.guns === gun0 + 50, '鉄砲購入');
  const gold0 = p.gold, rice0 = p.rice;
  ok(C.buyrice(p, g, 1000).ok && p.rice === rice0 + 1000 && p.gold < gold0, '兵糧購入で金が減る');
  ok(C.chakai(p, g).ok, '茶器を持つ者は茶会を開ける');
  const poor = E.provByName('飛騨'); poor.gold = 0;
  ok(!C.kaikon(poor, E.gensIn(poor.id)[0] || g).ok, '金が無ければ実行できない');
  const q = E.provByName('美濃');
  ok(C.yusou(p, q.id, 100, 100, 100).ok === false, '他家へは輸送できない');
}

/* ---------------- 合戦 ---------------- */
section('合戦');
{
  const st = E.newGame('s1560', '織田', 4242);
  const from = E.provByName('尾張'), to = E.provByName('美濃');
  ok(B.canAttack(from, to) === null, '隣接する他家へは出陣できる');
  ok(typeof B.canAttack(from, E.provByName('薩摩')) === 'string', '遠国へは出陣できない');
  const f = AI.buildForce(from, 3000, 2000, 5);
  const b = B.create(from, to, f, {});
  ok(B.side(b, 0).length > 0 && B.side(b, 1).length > 0, '両軍の部隊が生成される');
  ok(b.units.every(u => u.x >= 0 && u.x < B.W && u.y >= 0 && u.y < B.H), '部隊が盤内に配置される');
  const pos = new Set(b.units.map(u => u.x + ',' + u.y));
  ok(pos.size === b.units.length, '部隊が重ならない');
  B.autoRun(b);
  ok(!!b.over, '合戦が必ず決着する');
  const r = B.resolve(b);
  ok(r.winner === 0 ? E.provByName('美濃').owner === from.owner : E.provByName('美濃').owner !== from.owner, '勝敗と国の帰属が一致する');
}
{ /* 兵力差があれば大軍が勝つ（10回中8回以上） */
  let win = 0;
  for (let i = 0; i < 10; i++) {
    E.newGame('s1560', '織田', 900 + i);
    const from = E.provByName('尾張'), to = E.provByName('美濃');
    to.hei = 1200; to.castleLv = 30;
    from.hei = 6000;
    const b = B.create(from, to, AI.buildForce(from, 5500, 4000, 5), {});
    B.autoRun(b);
    if (b.over.winner === 0) win++;
  }
  ok(win >= 8, '五倍の兵で攻めればほぼ勝てる', win + '/10');
}

/* ---------------- 長期シミュレーション ---------------- */
section('長期シミュレーション');
for (const sc of ['s1560', 's1582']) {
  const st = E.newGame(sc, sc === 's1560' ? '織田' : '羽柴', 31337);
  const t0 = Date.now();
  for (let i = 0; i < 80 && !st.ended; i++) {
    AI.begin();
    let b, guard = 0;
    while ((b = AI.run()) && guard++ < 60) { B.autoRun(b); AI.finishBattle(b); }
    E.endSeason();
  }
  const alive = E.aliveClans();
  ok(alive.length >= 1, sc + '：20年後も家が残っている', alive.length);
  ok(st.provinces.every(p => p.hei >= 0 && p.gold >= 0 && p.rice >= 0), sc + '：資源が負にならない');
  ok(st.provinces.every(p => p.owner == null || !E.clan(p.owner).dead), sc + '：滅亡した家が国を持たない');
  ok(st.generals.every(g => g.clanId < 0 || (E.clan(g.clanId) && !E.clan(g.clanId).dead) || g.status === 'dead'),
     sc + '：滅亡した家に武将が残らない');
  const json = E.serialize();
  ok(json.length > 1000 && json.length < 3e6, sc + '：セーブデータの大きさが妥当', (json.length / 1024).toFixed(0) + 'KB');
  E.deserialize(json);
  E.endSeason();
  ok(E.getState().year >= st.year, sc + '：ロード後も季節を進められる');
  console.log('  （' + sc + ' 20年 ' + (Date.now() - t0) + 'ms　残存' + alive.length + '家　合戦' + st.history.battles + '回）');
}

console.log('\n' + (fails ? '✗ ' + fails + ' 件失敗' : '✓ 全て成功') + '（' + checks + ' 検査）');
process.exit(fails ? 1 : 0);
