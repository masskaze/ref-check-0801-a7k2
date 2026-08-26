/* =========================================================================
 *  戦国風雲録  —  合戦（グリッド戦術戦闘）
 * ========================================================================= */
(function (global) {
  'use strict';
  var NB = global.NB, E = NB.engine, U = NB.util;
  var B = (NB.battle = {});

  var W = 15, H = 11;
  B.W = W; B.H = H;

  /* ------------------------------ 地形 ------------------------------- */
  var TERR = B.TERR = [
    { id: 0, name: '平地', cost: 2, def: 0.00, ch: '', cls: 'plain' },
    { id: 1, name: '道',   cost: 1, def: -0.10, ch: '', cls: 'road' },
    { id: 2, name: '森',   cost: 3, def: 0.22, ch: '林', cls: 'forest' },
    { id: 3, name: '丘',   cost: 3, def: 0.30, ch: '丘', cls: 'hill' },
    { id: 4, name: '山',   cost: 5, def: 0.45, ch: '山', cls: 'mount' },
    { id: 5, name: '川',   cost: 4, def: -0.22, ch: '川', cls: 'river' },
    { id: 6, name: '沼',   cost: 4, def: 0.05, ch: '沼', cls: 'swamp' },
    { id: 7, name: '城壁', cost: 3, def: 0.55, ch: '城', cls: 'wall' },
    { id: 8, name: '本丸', cost: 2, def: 0.70, ch: '丸', cls: 'keep' }
  ];

  var TYPES = B.TYPES = {
    '足軽': { move: 8,  rng: 1, atk: 1.00, def: 1.00, name: '足軽' },
    '騎馬': { move: 12, rng: 1, atk: 1.18, def: 0.94, name: '騎馬' },
    '鉄砲': { move: 6,  rng: 3, atk: 0.92, def: 0.92, name: '鉄砲' }
  };
  var ADV = {
    '騎馬': { '足軽': 1.25, '鉄砲': 1.35, '騎馬': 1.00 },
    '足軽': { '足軽': 1.00, '騎馬': 0.88, '鉄砲': 1.15 },
    '鉄砲': { '足軽': 1.18, '騎馬': 1.45, '鉄砲': 1.00 }
  };

  function idx(x, y) { return y * W + x; }
  B.idx = idx;
  B.tile = function (b, x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? null : b.map[idx(x, y)]; };
  B.unitAt = function (b, x, y) {
    for (var i = 0; i < b.units.length; i++) {
      var u = b.units[i];
      if (u.alive && u.x === x && u.y === y) return u;
    }
    return null;
  };

  /* --------------------------- 地形の生成 ---------------------------- */
  function genMap(prov) {
    var rand = U.mulberry32((prov.id * 7919 + 13) | 0);
    var m = [], x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) m[idx(x, y)] = 0;

    /* 山と丘（外周寄り） */
    var mountains = 4 + Math.floor(rand() * 5);
    for (var i = 0; i < mountains; i++) {
      var mx = Math.floor(rand() * W), my = Math.floor(rand() * H);
      if (mx > 11) mx = 11;
      m[idx(mx, my)] = rand() < 0.45 ? 4 : 3;
      if (rand() < 0.6) { var nx = U.clamp(mx + (rand() < 0.5 ? 1 : -1), 0, 11), ny = U.clamp(my + (rand() < 0.5 ? 1 : -1), 0, H - 1); m[idx(nx, ny)] = 3; }
    }
    /* 森 */
    var forests = 6 + Math.floor(rand() * 6);
    for (i = 0; i < forests; i++) {
      var fx = Math.floor(rand() * 12), fy = Math.floor(rand() * H);
      if (m[idx(fx, fy)] === 0) m[idx(fx, fy)] = 2;
      if (rand() < 0.5) { var gx = U.clamp(fx + 1, 0, 11); if (m[idx(gx, fy)] === 0) m[idx(gx, fy)] = 2; }
    }
    /* 川（縦断） */
    if (rand() < 0.72) {
      var rx = 4 + Math.floor(rand() * 5);
      for (y = 0; y < H; y++) {
        m[idx(U.clamp(rx, 0, 12), y)] = 5;
        if (rand() < 0.45) rx += rand() < 0.5 ? 1 : -1;
      }
      /* 渡河点 */
      var fordY = 1 + Math.floor(rand() * (H - 2));
      for (y = 0; y < H; y++) if (Math.abs(y - fordY) <= 1) for (x = 0; x < W; x++) if (m[idx(x, y)] === 5 && rand() < 0.6) m[idx(x, y)] = 1;
    }
    /* 沼 */
    if (rand() < 0.4) {
      var sx = 2 + Math.floor(rand() * 8), sy = Math.floor(rand() * H);
      m[idx(sx, sy)] = 6;
      if (rand() < 0.6 && sy + 1 < H) m[idx(sx, sy + 1)] = 6;
    }
    /* 城（右側） */
    var cy = Math.floor(H / 2);
    for (y = cy - 2; y <= cy + 2; y++) {
      for (x = 12; x < W; x++) {
        if (y < 0 || y >= H) continue;
        m[idx(x, y)] = 7;
      }
    }
    m[idx(W - 1, cy)] = 8;
    m[idx(W - 1, cy - 1)] = 7; m[idx(W - 1, cy + 1)] = 7;
    /* 街道（左端から城門へ） */
    var ry = cy;
    for (x = 0; x < 12; x++) {
      if (m[idx(x, ry)] !== 5) m[idx(x, ry)] = 1;
      if (rand() < 0.3) ry = U.clamp(ry + (rand() < 0.5 ? 1 : -1), 1, H - 2);
    }
    return { map: m, keep: { x: W - 1, y: cy }, gate: { x: 12, y: cy } };
  }

  /* --------------------------- 部隊の生成 ---------------------------- */
  function makeUnit(b, side, gen, troops, type, homeProv) {
    var t = TYPES[type] || TYPES['足軽'];
    var tech = homeProv ? homeProv.tech : 30;
    var u = {
      id: b.units.length, side: side, gen: gen.id, name: gen.name,
      troops: Math.max(1, Math.round(troops)), max: Math.max(1, Math.round(troops)),
      type: type, morale: 0, x: 0, y: 0, mp: 0, moved: 0, acted: 0,
      alive: true, state: 'ok', confuse: 0, tech: tech,
      training: homeProv ? homeProv.training : 50, charged: 0, usedFire: 0
    };
    return u;
  }

  /* 陣形の初期配置 */
  function place(b, side, units) {
    var cy = Math.floor(H / 2), spots = [], x, y;
    if (side === 0) {
      for (y = 0; y < H; y++) for (x = 0; x <= 2; x++) spots.push([x, y, Math.abs(y - cy) * 3 + x]);
    } else {
      for (y = 0; y < H; y++) for (x = 8; x < W; x++) {
        var t = b.map[idx(x, y)];
        var d = Math.abs(x - b.keep.x) + Math.abs(y - b.keep.y);
        spots.push([x, y, d + (t >= 7 ? -6 : 0)]);
      }
    }
    spots.sort(function (a, c) { return a[2] - c[2]; });
    units.forEach(function (u) {
      for (var k = 0; k < spots.length; k++) {
        var sx = spots[k][0], sy = spots[k][1], tl = b.map[idx(sx, sy)];
        if (TERR[tl].cost > 4) continue;
        if (side === 0 && tl >= 7) continue;
        if (B.unitAt(b, sx, sy)) continue;
        u.x = sx; u.y = sy;
        return;
      }
    });
  }

  /* --------------------------- 合戦の開始 ---------------------------- */
  /* force = { prov, gens:[{gen,troops,type}], guns, horses, rice } */
  B.create = function (fromProv, toProv, force, opts) {
    opts = opts || {};
    var S = E.getState();
    var g = genMap(toProv);
    var b = {
      from: fromProv.id, prov: toProv.id,
      atkClan: fromProv.owner, defClan: toProv.owner,
      map: g.map, keep: g.keep, gate: g.gate,
      units: [], turn: 1, maxTurn: 30, side: 0, log: [],
      atkRice: force.rice, defRice: toProv.rice,
      wind: ['北', '東', '南', '西'][E.rnd(4)],
      fires: {}, over: null, phaseDone: false,
      castleLv: toProv.castleLv, spoils: null,
      naiou: [0, 0], selected: -1, autoAtk: !!opts.autoAtk, autoDef: !!opts.autoDef
    };

    /* 攻撃側 */
    force.gens.forEach(function (e) {
      if (e.troops <= 0) return;
      var u = makeUnit(b, 0, e.gen, e.troops, e.type, fromProv);
      u.morale = U.clamp(58 + Math.round(fromProv.training / 4) + Math.round((E.stat(e.gen, 'cha') - 50) / 5), 30, 100);
      b.units.push(u);
    });

    /* 守備側 */
    var defGens = E.gensIn(toProv.id).filter(function (x) { return x.clanId === toProv.owner; });
    if (!defGens.length) {
      /* 城代不在：兵だけの守備 */
      var dummy = { id: -1, name: '城兵', sen: 40, chi: 30, sei: 30, cha: 30, edu: 20, skills: [], items: [], loyalty: 100 };
      var du = makeUnit(b, 1, dummy, toProv.hei, '足軽', toProv);
      du.name = '城兵'; du.gen = -1;
      du.morale = U.clamp(45 + Math.round(toProv.minchu / 4), 25, 90);
      b.units.push(du);
    } else {
      defGens.sort(function (a, c) { return E.stat(c, 'sen') - E.stat(a, 'sen'); });
      defGens = defGens.slice(0, 8);
      var total = toProv.hei, gunsLeft = toProv.guns, horseLeft = toProv.horses;
      var share = [];
      var wsum = 0;
      defGens.forEach(function (x) { var w = E.stat(x, 'sen') + 40; wsum += w; share.push(w); });
      defGens.forEach(function (x, i) {
        var troops = Math.round(total * share[i] / wsum);
        var type = '足軽';
        if (E.has(x, '鉄砲') && gunsLeft >= troops / 3) { type = '鉄砲'; gunsLeft -= Math.round(troops / 3); }
        else if (E.has(x, '騎馬') && horseLeft >= troops / 4) { type = '騎馬'; horseLeft -= Math.round(troops / 4); }
        else if (gunsLeft >= troops / 3 && i % 3 === 1) { type = '鉄砲'; gunsLeft -= Math.round(troops / 3); }
        else if (horseLeft >= troops / 4 && i % 3 === 2) { type = '騎馬'; horseLeft -= Math.round(troops / 4); }
        if (troops <= 0) return;
        var u = makeUnit(b, 1, x, troops, type, toProv);
        u.morale = U.clamp(62 + Math.round(toProv.training / 4) + Math.round(toProv.castleLv / 8) + Math.round((x.loyalty - 60) / 6), 30, 100);
        b.units.push(u);
      });
    }

    place(b, 0, b.units.filter(function (u) { return u.side === 0; }));
    place(b, 1, b.units.filter(function (u) { return u.side === 1; }));
    B.startPhase(b, 0);
    b.log.push({ t: '【合戦】' + E.clan(b.atkClan).name + '軍が' + toProv.name + 'に攻め入った！　風は' + b.wind + '風。', k: 'big' });
    return b;
  };

  B.side = function (b, s) { return b.units.filter(function (u) { return u.alive && u.side === s; }); };
  B.gen = function (u) { return u.gen >= 0 ? E.gen(u.gen) : { name: '城兵', sen: 40, chi: 30, sei: 30, cha: 30, edu: 20, skills: [], items: [], loyalty: 100 }; };
  B.stat = function (u, k) { return u.gen >= 0 ? E.stat(E.gen(u.gen), k) : ({ sen: 40, chi: 30, sei: 30, cha: 30, edu: 20 })[k]; };
  B.has = function (u, s) { return u.gen >= 0 && E.has(E.gen(u.gen), s); };

  /* --------------------------- フェイズ ------------------------------ */
  B.startPhase = function (b, side) {
    b.side = side;
    B.side(b, side).forEach(function (u) {
      u.mp = TYPES[u.type].move + (u.state === 'confused' ? -4 : 0);
      if (u.mp < 0) u.mp = 0;
      u.moved = 0; u.acted = 0; u.charged = 0;
      if (u.confuse > 0) { u.confuse--; if (u.confuse === 0) u.state = 'ok'; }
    });
    b.phaseDone = false;
  };

  B.endPhase = function (b) {
    if (b.over) return;
    if (b.side === 0) { B.startPhase(b, 1); return; }
    /* 一巡：兵糧消費・延焼・判定 */
    B.turnEnd(b);
    if (b.over) return;
    b.turn++;
    if (b.turn > b.maxTurn) { B.finish(b, 1, '日暮れ'); return; }
    B.startPhase(b, 0);
  };

  B.turnEnd = function (b) {
    var atkTroops = 0, defTroops = 0;
    B.side(b, 0).forEach(function (u) { atkTroops += u.troops; });
    B.side(b, 1).forEach(function (u) { defTroops += u.troops; });
    b.atkRice -= Math.round(atkTroops / 55) + 1;
    b.defRice -= Math.round(defTroops / 90) + 1;
    if (b.atkRice <= 0) {
      b.atkRice = 0;
      B.side(b, 0).forEach(function (u) { u.morale = U.clamp(u.morale - 12, 0, 100); });
      b.log.push({ t: '寄せ手の兵糧が尽きた！　士気が崩れてゆく。', k: 'bad' });
      if (b.turn > 3) { B.finish(b, 1, '兵糧尽き'); return; }
    }
    if (b.defRice <= 0) {
      b.defRice = 0;
      B.side(b, 1).forEach(function (u) { u.morale = U.clamp(u.morale - 10, 0, 100); });
      b.log.push({ t: '城内の兵糧が底をついた。', k: 'bad' });
    }
    /* 延焼 */
    var newFires = {};
    for (var k in b.fires) {
      var f = b.fires[k];
      if (f <= 0) continue;
      var xy = k.split(',').map(Number);
      var u2 = B.unitAt(b, xy[0], xy[1]);
      if (u2) {
        var dmg = Math.round(u2.troops * 0.07);
        u2.troops -= dmg; u2.morale = U.clamp(u2.morale - 8, 0, 100);
        b.log.push({ t: u2.name + '隊が炎に巻かれ' + U.num(dmg) + 'を失った。', k: u2.side === 0 ? 'bad' : 'good' });
        B.checkDead(b, u2);
      }
      if (f > 1) {
        var d = { '北': [0, 1], '南': [0, -1], '東': [-1, 0], '西': [1, 0] }[b.wind];
        var nx = xy[0] + d[0], ny = xy[1] + d[1];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && TERR[b.map[idx(nx, ny)]].id !== 5) newFires[nx + ',' + ny] = f - 1;
      }
      if (f - 1 > 0) newFires[k] = f - 1;
    }
    b.fires = newFires;
    B.checkOver(b);
  };

  /* --------------------------- 移動 ---------------------------------- */
  B.reachable = function (b, u) {
    var dist = {}, res = [], q = [[u.x, u.y, u.mp]];
    dist[u.x + ',' + u.y] = u.mp;
    while (q.length) {
      var c = q.shift(), cx = c[0], cy = c[1], mp = c[2];
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < 4; i++) {
        var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var t = TERR[b.map[idx(nx, ny)]];
        var cost = t.cost;
        if (u.type === '騎馬' && (t.id === 4 || t.id === 6)) cost += 2;
        if (u.type === '鉄砲' && t.id === 4) cost += 1;
        if (t.id >= 7 && u.side === 0) cost += 2;
        var other = B.unitAt(b, nx, ny);
        if (other && other.side !== u.side) continue;
        var left = mp - cost;
        if (left < 0) continue;
        var key = nx + ',' + ny;
        if (dist[key] !== undefined && dist[key] >= left) continue;
        dist[key] = left;
        q.push([nx, ny, left]);
        if (!other) res.push({ x: nx, y: ny, left: left });
      }
    }
    return res;
  };

  B.move = function (b, u, x, y) {
    if (u.acted) return false;
    var r = B.reachable(b, u), i;
    for (i = 0; i < r.length; i++) {
      if (r[i].x === x && r[i].y === y) {
        var dist = Math.abs(u.x - x) + Math.abs(u.y - y);
        u.moved += dist;
        u.x = x; u.y = y; u.mp = r[i].left;
        /* 火に飛び込む */
        if (b.fires[x + ',' + y]) {
          var dmg = Math.round(u.troops * 0.05);
          u.troops -= dmg; u.morale = U.clamp(u.morale - 5, 0, 100);
          B.checkDead(b, u);
        }
        return true;
      }
    }
    return false;
  };

  /* --------------------------- 攻撃 ---------------------------------- */
  B.dist = function (a, c) { return Math.abs(a.x - c.x) + Math.abs(a.y - c.y); };

  B.targets = function (b, u) {
    var rng = TYPES[u.type].rng;
    if (u.type === '鉄砲') rng = Math.max(2, Math.min(3, 2 + Math.floor(u.tech / 55)));
    return B.side(b, 1 - u.side).filter(function (t) { return B.dist(u, t) <= rng; });
  };

  function terrDef(b, u) {
    var t = TERR[b.map[idx(u.x, u.y)]];
    var d = t.def;
    if (t.id >= 7) d += b.castleLv / 320;
    return d;
  }

  function power(b, u) {
    var sen = B.stat(u, 'sen');
    return u.troops * (0.48 + sen / 118) * (0.62 + u.morale / 260) * (0.72 + u.training / 300);
  }

  /* mode: 'normal' | 'charge' | 'volley' */
  B.attack = function (b, u, t, mode) {
    if (u.acted) return null;
    mode = mode || 'normal';
    var d = B.dist(u, t);
    var ranged = (u.type === '鉄砲' && d > 1);
    if (!ranged && d > 1) return null;
    if (mode === 'charge' && (u.type !== '騎馬' || d > 1)) return null;

    var adv = ADV[u.type][t.type] || 1;
    var mul = TYPES[u.type].atk * adv;
    if (u.type === '鉄砲') {
      if (ranged) mul *= 1.0 + u.tech / 220;
      else mul *= 0.55;
    }
    if (mode === 'charge') mul *= 1.55;
    if (u.state === 'confused') mul *= 0.45;
    if (TERR[b.map[idx(u.x, u.y)]].id === 5) mul *= 0.7;      /* 川からの攻撃 */

    var dmg = power(b, u) * mul * 0.155 / (1 + terrDef(b, t) * TYPES[t.type].def);
    dmg *= 0.85 + E.rng() * 0.3;
    dmg = Math.max(1, Math.round(dmg));
    if (dmg > t.troops) dmg = t.troops;
    t.troops -= dmg;
    var mloss = Math.round(dmg / Math.max(1, t.max) * 100 * 0.9) + 3;
    t.morale = U.clamp(t.morale - mloss, 0, 100);
    u.morale = U.clamp(u.morale + 2, 0, 100);

    var res = { dmg: dmg, back: 0, mode: mode, ranged: ranged, target: t.name, unit: u.name };

    /* 鉄砲の斉射は混乱を誘う */
    if (u.type === '鉄砲' && ranged && E.rng() < 0.10 + u.tech / 500) {
      t.state = 'confused'; t.confuse = 1;
      res.confused = true;
    }
    /* 反撃 */
    B.checkDead(b, t);
    if (t.alive && !ranged) {
      var badv = ADV[t.type][u.type] || 1;
      var bmul = TYPES[t.type].atk * badv * (t.type === '鉄砲' ? 0.5 : 0.62);
      if (t.state === 'confused') bmul *= 0.45;
      var back = power(b, t) * bmul * 0.155 / (1 + terrDef(b, u) * TYPES[u.type].def);
      back *= 0.85 + E.rng() * 0.3;
      if (mode === 'charge') back *= 1.35;
      back = Math.max(0, Math.round(back));
      if (back > u.troops) back = u.troops;
      u.troops -= back;
      u.morale = U.clamp(u.morale - Math.round(back / Math.max(1, u.max) * 100 * 0.9), 0, 100);
      res.back = back;
      B.checkDead(b, u);
    }
    u.acted = 1; u.mp = 0;
    b.log.push({
      t: u.name + '隊が' + t.name + '隊を' + (mode === 'charge' ? '突撃！' : ranged ? '斉射！' : '攻撃！') +
        '　' + t.name + '隊' + U.num(dmg) + '討ち取る' + (res.back ? '（自軍' + U.num(res.back) + '損）' : '') +
        (res.confused ? '　＜混乱＞' : ''),
      k: u.side === 0 ? 'atk' : 'def'
    });
    B.checkOver(b);
    return res;
  };

  /* --------------------------- 計略 ---------------------------------- */
  B.canFire = function (b, u) {
    return !u.acted && !u.usedFire && B.stat(u, 'chi') >= 62;
  };
  B.fire = function (b, u, x, y) {
    if (!B.canFire(b, u)) return { ok: false, msg: 'この隊に火計は使えません。' };
    if (B.dist(u, { x: x, y: y }) > 3) return { ok: false, msg: '遠すぎます。' };
    var t = TERR[b.map[idx(x, y)]];
    if (t.id === 5) return { ok: false, msg: '川には火がつきません。' };
    u.acted = 1; u.mp = 0; u.usedFire = 1;
    var ch = U.clamp(30 + B.stat(u, 'chi') - 40 + (t.id === 2 ? 25 : 0) + (t.id >= 7 ? 10 : 0), 10, 92);
    if (E.rnd(100) < ch) {
      b.fires[x + ',' + y] = 3;
      var v = B.unitAt(b, x, y);
      var msg = '火計成功！';
      if (v) {
        var dmg = Math.round(v.troops * (0.10 + B.stat(u, 'chi') / 900));
        v.troops -= dmg; v.morale = U.clamp(v.morale - 14, 0, 100);
        msg += '　' + v.name + '隊' + U.num(dmg) + 'を焼く。';
        B.checkDead(b, v);
      }
      b.log.push({ t: u.name + 'の火計！ ' + msg, k: u.side === 0 ? 'atk' : 'def' });
      B.checkOver(b);
      return { ok: true, msg: msg };
    }
    b.log.push({ t: u.name + 'は火を放とうとしたが失敗した。', k: '' });
    return { ok: true, msg: '火計は失敗した。（成功率' + ch + '%）' };
  };

  B.taunt = function (b, u, t) {
    if (u.acted) return { ok: false, msg: '行動済みです。' };
    if (B.dist(u, t) > 4) return { ok: false, msg: '遠すぎます。' };
    u.acted = 1; u.mp = 0;
    var ch = U.clamp(40 + B.stat(u, 'chi') - B.stat(t, 'chi') - t.morale / 4, 8, 90);
    if (E.rnd(100) < ch) {
      t.morale = U.clamp(t.morale - (8 + E.rnd(10)), 0, 100);
      b.log.push({ t: u.name + 'の挑発！ ' + t.name + '隊の士気が下がった。', k: u.side === 0 ? 'atk' : 'def' });
      return { ok: true, msg: t.name + '隊の士気が下がった。' };
    }
    return { ok: true, msg: '挑発は効かなかった。（成功率' + ch + '%）' };
  };

  B.naiou = function (b, u, t) {
    if (u.acted) return { ok: false, msg: '行動済みです。' };
    if (b.naiou[u.side]) return { ok: false, msg: '内応の手はもう使えません。' };
    if (t.gen < 0) return { ok: false, msg: '城兵は寝返りません。' };
    var tg = E.gen(t.gen);
    var clan = E.clan(t.side === 0 ? b.atkClan : b.defClan);
    if (clan && clan.lordId === tg.id) return { ok: false, msg: '敵の当主は寝返りません。' };
    u.acted = 1; u.mp = 0; b.naiou[u.side] = 1;
    var ch = U.clamp(Math.round(18 + (B.stat(u, 'chi') - 50) * 0.5 + (100 - tg.loyalty) * 0.55 + (tg.amb - 50) * 0.25), 3, 85);
    if (E.rnd(100) < ch) {
      t.side = u.side;
      t.morale = U.clamp(t.morale + 10, 0, 100);
      tg.loyalty = 45;
      b.log.push({ t: '◆ ' + t.name + '隊が寝返った！', k: 'big' });
      B.checkOver(b);
      return { ok: true, msg: t.name + 'が寝返った！' };
    }
    b.log.push({ t: u.name + 'の内応の誘いは退けられた。', k: '' });
    return { ok: true, msg: '内応は失敗した。（成功率' + ch + '%）' };
  };

  B.rest = function (b, u) {
    if (u.acted) return false;
    u.acted = 1; u.mp = 0;
    u.morale = U.clamp(u.morale + 4 + Math.round(B.stat(u, 'cha') / 25), 0, 100);
    if (u.state === 'confused') { u.state = 'ok'; u.confuse = 0; }
    return true;
  };

  /* --------------------------- 生死・決着 ---------------------------- */
  B.checkDead = function (b, u) {
    if (!u.alive) return;
    if (u.troops <= 0 || u.morale <= 0 || u.troops < u.max * 0.10) {
      u.alive = false;
      u.state = u.troops <= 0 ? 'destroyed' : 'routed';
      b.log.push({ t: u.name + '隊は' + (u.troops <= 0 ? '壊滅した！' : '崩れて退いた！') , k: u.side === 0 ? 'bad' : 'good' });
      /* 味方の士気低下 */
      B.side(b, u.side).forEach(function (v) { v.morale = U.clamp(v.morale - 5, 0, 100); });
    }
  };

  B.checkOver = function (b) {
    if (b.over) return;
    var a = B.side(b, 0), d = B.side(b, 1);
    if (!a.length) { B.finish(b, 1, '寄せ手崩壊'); return; }
    if (!d.length) { B.finish(b, 0, '城兵壊滅'); return; }
    /* 本丸占拠 */
    var k = B.unitAt(b, b.keep.x, b.keep.y);
    if (k && k.side === 0) { B.finish(b, 0, '本丸占拠'); return; }
  };

  B.finish = function (b, winner, why) {
    if (b.over) return;
    b.over = { winner: winner, why: why };
    b.log.push({ t: '【決着】' + (winner === 0 ? '寄せ手' : '城方') + 'の勝利（' + why + '）', k: 'big' });
  };

  /* --------------------------- 戦後処理 ------------------------------ */
  B.resolve = function (b) {
    var S = E.getState();
    var from = E.prov(b.from), prov = E.prov(b.prov);
    var atkClan = b.atkClan, defClan = b.defClan;
    var r = { winner: b.over ? b.over.winner : 1, captured: [], dead: [], taken: false, msgs: [] };

    /* 損害の反映 */
    var atkSurv = 0, defSurv = 0;
    b.units.forEach(function (u) {
      if (u.side === 0) atkSurv += u.alive ? u.troops : Math.round(u.troops * 0.25);
      else defSurv += u.alive ? u.troops : Math.round(u.troops * 0.25);
    });

    /* 武将の生死 */
    b.units.forEach(function (u) {
      if (u.gen < 0) return;
      var g = E.gen(u.gen);
      if (g.status !== 'active') return;
      var lost = !u.alive;
      var loserSide = (r.winner === 0) ? 1 : 0;
      if (!lost) return;
      var risk = (u.state === 'destroyed') ? 0.30 : 0.10;
      if (u.side === loserSide) risk += 0.10;
      risk -= E.stat(g, 'sen') / 900;
      if (E.has(g, '騎馬') || E.has(g, '剣豪')) risk -= 0.05;
      if (risk < 0.03) risk = 0.03;
      var roll = E.rng();
      if (roll < risk * 0.35) {
        r.dead.push(g.name);
        E.killGeneral(g, '討死');
      } else if (u.side === loserSide && roll < risk) {
        g.status = 'captive';
        g.captiveOf = (u.side === 0) ? defClan : atkClan;
        g.provId = prov.id;
        r.captured.push(g.id);
      }
    });

    if (r.winner === 0) {
      /* 攻撃側勝利：国を奪う */
      var spoilGold = Math.round(prov.gold * 0.6), spoilRice = Math.round(prov.rice * 0.4);
      prov.gold -= spoilGold; prov.rice = Math.max(0, Math.round(b.defRice * 0.5));
      prov.hei = Math.max(0, defSurv > 0 ? Math.round(defSurv * 0.3) : 0);
      prov.guns = Math.round(prov.guns * 0.5);
      prov.horses = Math.round(prov.horses * 0.5);
      prov.castleLv = U.clamp(prov.castleLv - E.range(6, 16), 5, 100);
      prov.training = U.clamp(Math.round(prov.training * 0.7), 0, 100);

      /* 守備側の生き残った武将は退却 */
      var escape = null;
      prov.adj.forEach(function (aid) { if (!escape && E.prov(aid).owner === defClan) escape = aid; });
      E.gensIn(prov.id).filter(function (g) { return g.clanId === defClan; }).forEach(function (g) {
        if (escape != null) g.provId = escape;
        else { g.clanId = -1; g.status = 'free'; g.loyalty = 0; }
      });

      E.transferProvince(prov.id, atkClan);
      prov.hei += atkSurv;
      prov.gold += spoilGold;
      prov.rice += spoilRice;
      prov.training = Math.round((prov.training + from.training) / 2);

      /* 攻撃武将を入国させる */
      b.units.forEach(function (u) {
        if (u.side !== 0 || u.gen < 0) return;
        var g = E.gen(u.gen);
        if (g.status === 'active') g.provId = prov.id;
      });
      E.assignLord(prov);
      r.taken = true;
      r.msgs.push(prov.name + 'を攻め取った！　兵' + U.num(atkSurv) + '・金' + U.num(spoilGold) + '・米' + U.num(spoilRice) + 'を得た。');
    } else {
      /* 守備側勝利：攻撃側は退却 */
      from.hei += atkSurv;
      prov.hei = defSurv;
      prov.rice = Math.max(0, b.defRice);
      prov.guns = Math.round(prov.guns * 0.85);
      prov.horses = Math.round(prov.horses * 0.85);
      prov.castleLv = U.clamp(prov.castleLv - E.range(0, 8), 5, 100);
      b.units.forEach(function (u) {
        if (u.side !== 0 || u.gen < 0) return;
        var g = E.gen(u.gen);
        if (g.status === 'active') g.provId = from.id;
      });
      from.rice += Math.max(0, b.atkRice);
      E.assignLord(from); E.assignLord(prov);
      r.msgs.push(E.clan(atkClan).name + '軍は' + prov.name + 'から退いた。');
    }
    E.getState().history.battles++;
    return r;
  };

  /* --------------------------- 捕虜の処遇 ---------------------------- */
  B.captiveAction = function (genId, action, clanId) {
    var g = E.gen(genId);
    if (!g || g.status !== 'captive') return { ok: false, msg: '' };
    if (action === 'kill') {
      var nm = g.name;
      E.killGeneral(g, '処刑');
      var c = E.clan(clanId);
      c.reputation = U.clamp(c.reputation - 8, 0, 100);
      return { ok: true, msg: nm + 'を斬った。（信用が下がった）' };
    }
    if (action === 'free') {
      g.status = 'free'; g.clanId = -1; g.loyalty = 0;
      var c2 = E.clan(clanId);
      c2.reputation = U.clamp(c2.reputation + 4, 0, 100);
      return { ok: true, msg: g.name + 'を解き放った。（信用が上がった）' };
    }
    if (action === 'hire') {
      var lord = E.lordOf(clanId);
      var ch = U.clamp(Math.round(26 + (lord ? lord.cha - 50 : 0) * 0.6 - E.compat(g, lord) * 0.7 - g.giri * 0.35 + E.clan(clanId).reputation * 0.2), 3, 92);
      if (E.rnd(100) < ch) {
        g.status = 'active'; g.clanId = clanId; g.loyalty = 55;
        var cp = E.clan(clanId).capital;
        g.provId = cp >= 0 ? cp : g.provId;
        E.assignLord(E.prov(g.provId));
        return { ok: true, msg: '◆ ' + g.name + 'が家臣となった！', hired: true };
      }
      return { ok: false, msg: g.name + 'は首を縦に振らなかった。（成功率' + ch + '%）', chance: ch };
    }
    return { ok: false, msg: '' };
  };

  /* ============================ 戦闘AI =============================== */
  function evalTarget(b, u, t) {
    var adv = ADV[u.type][t.type] || 1;
    var score = adv * 100;
    score += (100 - t.morale) * 0.6;
    score += (1 - t.troops / Math.max(1, t.max)) * 60;
    score -= terrDef(b, t) * 90;
    score -= B.dist(u, t) * 6;
    if (t.gen >= 0) {
      var g = E.gen(t.gen);
      var c = E.clan(t.side === 0 ? b.atkClan : b.defClan);
      if (c && c.lordId === g.id) score += 40;
    }
    return score;
  }

  B.aiUnit = function (b, u) {
    if (u.acted || !u.alive) return;
    var enemies = B.side(b, 1 - u.side);
    if (!enemies.length) return;

    /* 火計 */
    if (B.canFire(b, u) && E.rng() < 0.35) {
      var fc = null, fbest = -1;
      enemies.forEach(function (t) {
        if (B.dist(u, t) > 3) return;
        var sc = t.troops - terrDef(b, t) * 200;
        if (TERR[b.map[idx(t.x, t.y)]].id === 2) sc += 300;
        if (sc > fbest) { fbest = sc; fc = t; }
      });
      if (fc && fbest > 400) { B.fire(b, u, fc.x, fc.y); return; }
    }

    /* 攻撃可能なら最良の相手を攻撃 */
    var ts = B.targets(b, u);
    if (ts.length) {
      ts.sort(function (a, c) { return evalTarget(b, u, c) - evalTarget(b, u, a); });
      var best = ts[0];
      var mode = 'normal';
      if (u.type === '騎馬' && B.dist(u, best) === 1 && (best.morale < 55 || u.troops > best.troops * 1.2)) mode = 'charge';
      B.attack(b, u, best, mode);
      return;
    }

    /* 移動：城攻め側は本丸を目指しつつ敵に寄る */
    var goal = null, gbest = -1e9;
    enemies.forEach(function (t) {
      var sc = evalTarget(b, u, t);
      if (sc > gbest) { gbest = sc; goal = t; }
    });
    var aim = goal;
    if (u.side === 0 && b.turn > b.maxTurn * 0.55) {
      var kd = Math.abs(u.x - b.keep.x) + Math.abs(u.y - b.keep.y);
      if (kd < 8 || !goal) aim = { x: b.keep.x, y: b.keep.y };
    }
    var cells = B.reachable(b, u);
    if (!cells.length) { B.rest(b, u); return; }
    var bestCell = null, bs = -1e9;
    cells.forEach(function (c) {
      var d = Math.abs(c.x - aim.x) + Math.abs(c.y - aim.y);
      var sc = -d * 10;
      sc += TERR[b.map[idx(c.x, c.y)]].def * 40;
      if (b.fires[c.x + ',' + c.y]) sc -= 120;
      if (u.type === '鉄砲') {
        var rr = Math.max(2, Math.min(3, 2 + Math.floor(u.tech / 55)));
        if (d <= rr && d >= 2) sc += 60;
        if (d <= 1) sc -= 40;
      }
      if (u.side === 1 && TERR[b.map[idx(c.x, c.y)]].id >= 7) sc += 25;
      sc += E.rng() * 8;
      if (sc > bs) { bs = sc; bestCell = c; }
    });
    if (bestCell) B.move(b, u, bestCell.x, bestCell.y);
    var ts2 = B.targets(b, u);
    if (ts2.length && !u.acted) {
      ts2.sort(function (a, c) { return evalTarget(b, u, c) - evalTarget(b, u, a); });
      var m2 = (u.type === '騎馬' && u.moved >= 3) ? 'charge' : 'normal';
      if (B.dist(u, ts2[0]) > 1) m2 = 'normal';
      B.attack(b, u, ts2[0], m2);
    } else if (!u.acted) {
      B.rest(b, u);
    }
  };

  B.aiPhase = function (b) {
    var side = b.side;
    var us = B.side(b, side).slice();
    /* 内応を一度だけ試みる */
    if (!b.naiou[side]) {
      var caster = null;
      us.forEach(function (u) { if (!caster && B.stat(u, 'chi') >= 80 && !u.acted) caster = u; });
      if (caster && E.rng() < 0.25) {
        var cand = B.side(b, 1 - side).filter(function (t) {
          return t.gen >= 0 && E.gen(t.gen).loyalty < 60;
        });
        if (cand.length) B.naiou(b, caster, cand[0]);
      }
    }
    us.sort(function (a, c) { return (TYPES[c.type].rng - TYPES[a.type].rng) || (c.troops - a.troops); });
    us.forEach(function (u) { if (u.alive && !b.over) B.aiUnit(b, u); });
    if (!b.over) B.endPhase(b);
  };

  /* 完全自動：AI 同士／委任 */
  B.autoRun = function (b, guard) {
    var n = 0;
    while (!b.over && n < (guard || 400)) {
      B.aiPhase(b);
      n++;
    }
    if (!b.over) B.finish(b, 1, '日暮れ');
    return b;
  };

  /* 出陣可能判定 */
  B.canAttack = function (from, to) {
    if (from.owner == null) return '自国ではありません。';
    if (from.adj.indexOf(to.id) < 0) return '隣国ではありません。';
    if (to.owner === from.owner) return '自国です。';
    if (to.owner != null && E.allied(from.owner, to.owner)) return '同盟国です。';
    if (from.hei < 100) return '兵が足りません。';
    if (from.acted >= from.actMax) return 'この国はもう動けません。';
    return null;
  };

})(typeof window !== 'undefined' ? window : globalThis);
