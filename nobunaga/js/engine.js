/* =========================================================================
 *  戦国風雲録  —  エンジン（状態・季節処理・経済・イベント）
 * ========================================================================= */
(function (global) {
  'use strict';
  var NB = global.NB || (global.NB = {});
  var DATA = NB.DATA;

  /* ============================== ユーティリティ ======================= */
  var U = (NB.util = {});

  U.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  U.hash = function (s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };
  U.num = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  /* ============================== エンジン ============================= */
  var E = (NB.engine = {});
  var S = null;                       // 現在のゲーム状態

  E.getState = function () { return S; };
  E.setState = function (s) { S = s; };

  function rnd(n) { return Math.floor(S.rng() * n); }          // 0..n-1
  function rng() { return S.rng(); }
  function range(a, b) { return a + Math.floor(S.rng() * (b - a + 1)); }
  E.rnd = rnd; E.rng = rng; E.range = range;

  /* --------------------------- 参照ヘルパ ----------------------------- */
  E.prov = function (id) { return S.provinces[id]; };
  E.gen = function (id) { return S.generals[id]; };
  E.clan = function (id) { return id == null ? null : S.clans[id]; };
  E.provByName = function (n) { for (var i = 0; i < S.provinces.length; i++) if (S.provinces[i].name === n) return S.provinces[i]; return null; };
  E.genByName = function (n) { for (var i = 0; i < S.generals.length; i++) if (S.generals[i].name === n) return S.generals[i]; return null; };
  E.clanByName = function (n) { for (var i = 0; i < S.clans.length; i++) if (S.clans[i].name === n) return S.clans[i]; return null; };

  E.provsOf = function (cid) { return S.provinces.filter(function (p) { return p.owner === cid; }); };
  E.gensIn = function (pid) {
    return S.generals.filter(function (g) { return g.provId === pid && g.status === 'active'; });
  };
  E.gensOf = function (cid) {
    return S.generals.filter(function (g) { return g.clanId === cid && g.status === 'active'; });
  };
  E.freeGensIn = function (pid) {
    return S.generals.filter(function (g) { return g.provId === pid && g.status === 'free'; });
  };
  E.lordOf = function (cid) { var c = E.clan(cid); return c ? E.gen(c.lordId) : null; };
  E.isPlayer = function (cid) { return cid === S.playerClan; };
  E.aliveClans = function () { return S.clans.filter(function (c) { return !c.dead; }); };

  /* 武将の能力（宝物込み） */
  E.stat = function (g, key) {
    var v = g[key] || 0, i, t;
    for (i = 0; i < g.items.length; i++) {
      t = S.treasures[g.items[i]];
      if (!t) continue;
      if (t.kind === '刀' && key === 'sen') v += t.value;
      else if (t.kind === '馬' && key === 'sen') v += t.value;
      else if (t.kind === '書' && key === 'chi') v += t.value;
      else if (t.kind === '茶器' && key === 'edu') v += Math.round(t.value / 10);
    }
    return U.clamp(v, 1, 120);
  };
  E.has = function (g, skill) { return g.skills.indexOf(skill) >= 0; };
  E.age = function (g) { return S.year - g.born; };

  /* 相性（0-99）。近いほど仲が良い */
  E.compat = function (a, b) {
    if (!a || !b) return 50;
    var d = Math.abs(a.aisho - b.aisho);
    if (d > 50) d = 100 - d;
    return d; // 0=最良, 50=最悪
  };

  /* 国の最大兵力・上限値 */
  E.maxHei = function (p) { return Math.round(p.koku * 9 + p.shou * 2 + p.castleLv * 20); };
  E.maxKoku = function (p) { return Math.round(p.baseKoku * 1.7); };
  E.maxShou = function (p) { return Math.round(p.baseShou * 1.9); };
  E.maxGun = function (p) { return Math.round(p.hei / 3 + 200); };
  E.maxHorse = function (p) { return Math.round(p.hei / 4 + 150); };

  /* 国力（AI 評価・表示用） */
  E.power = function (p) {
    return Math.round(p.koku * 1.2 + p.shou * 0.8 + p.hei * 0.6 + p.castleLv * 12 +
                      p.guns * 1.5 + p.horses * 1.0 + p.tech * 6 + p.culture * 4);
  };
  E.clanPower = function (cid) {
    var t = 0;
    E.provsOf(cid).forEach(function (p) { t += E.power(p); });
    E.gensOf(cid).forEach(function (g) { t += (g.sen + g.chi + g.sei) * 2; });
    return t;
  };

  /* ============================== ログ ================================= */
  E.log = function (msg, kind) {
    S.log.push({ y: S.year, s: S.season, t: msg, k: kind || '' });
    if (S.log.length > 400) S.log.shift();
    if (NB.ui && NB.ui.onLog) NB.ui.onLog(msg, kind);
  };

  /* ============================ ゲーム生成 ============================= */
  E.newGame = function (scenarioId, clanName, seed) {
    var sc = null, i, j;
    for (i = 0; i < DATA.scenarios.length; i++) if (DATA.scenarios[i].id === scenarioId) sc = DATA.scenarios[i];
    if (!sc) sc = DATA.scenarios[0];

    S = {
      scenarioId: sc.id, year: sc.year, season: sc.season || 0,
      seedVal: seed || Math.floor(Math.random() * 1e9),
      provinces: [], generals: [], clans: [], treasures: [],
      playerClan: 0, log: [], ricePrice: 32, gunPrice: 28, horsePrice: 20,
      turnPhase: 'player', pendingBattle: null, over: null, ended: false,
      history: { battles: 0, taken: 0 }
    };
    S.rng = U.mulberry32(S.seedVal);

    /* --- 国 --- */
    DATA.provinces.forEach(function (d, idx) {
      var adj = [], sea = [];
      d.adj.forEach(function (a) {
        var isSea = a.charAt(0) === '~', nm = isSea ? a.slice(1) : a;
        var k = DATA.provinces.findIndex(function (x) { return x.name === nm; });
        adj.push(k); if (isSea) sea.push(k);
      });
      S.provinces.push({
        id: idx, name: d.name, castle: d.castle, x: d.x, y: d.y, region: d.region,
        adj: adj, sea: sea,
        baseKoku: d.koku, baseShou: d.shou,
        koku: d.koku, shou: d.shou, chisui: d.chisui, minchu: 58 + (idx % 7),
        tech: d.tech, culture: d.culture,
        port: d.port, mine: d.mine, horseLand: d.horse, gunLand: d.gun,
        hei: 0, rice: 0, gold: 0, guns: 0, horses: 0,
        training: 40, castleLv: 30 + (idx % 5) * 4,
        owner: null, lordGen: -1, acted: 0, actMax: 1, ikki: 0, siegeFrom: -1
      });
    });

    /* --- 武将 --- */
    DATA.generalTable.trim().split('\n').forEach(function (line, idx) {
      var f = line.split('|');
      if (f.length < 10) return;
      S.generals.push({
        id: S.generals.length, name: f[0],
        sei: +f[1], sen: +f[2], chi: +f[3], cha: +f[4],
        amb: +f[5], giri: +f[6], edu: +f[7],
        born: +f[8], fate: +f[9],
        skills: f[10] ? f[10].split(',').filter(Boolean) : [],
        aisho: U.hash(f[0]) % 100,
        clanId: -1, provId: -1, loyalty: 70, status: 'none',
        items: [], exploit: 0, tired: 0
      });
    });

    /* --- 宝物 --- */
    DATA.treasures.forEach(function (t, i2) {
      S.treasures.push({ id: i2, name: t.name, kind: t.kind, value: t.value, owner: -1, hidden: 1, prov: -1 });
    });

    /* --- 大名家 --- */
    sc.clans.forEach(function (c, ci) {
      var lord = E.genByName(c.lord);
      var clan = {
        id: ci, name: c.name, color: c.color, lordId: lord ? lord.id : -1,
        dead: false, ally: {}, truce: {}, reputation: 50, gold: 0,
        personality: null, capital: -1, courtRank: 0, shogun: 0
      };
      S.clans.push(clan);
      c.provs.forEach(function (pn, k) {
        var p = E.provByName(pn);
        if (!p) return;
        p.owner = ci;
        if (k === 0) clan.capital = p.id;
      });
      var members = [c.lord].concat(c.men);
      members.forEach(function (nm, k) {
        var g = E.genByName(nm);
        if (!g) return;
        var age = sc.year - g.born;
        if (g.fate < sc.year || age > 74) { g.status = 'dead'; return; }
        g.clanId = ci; g.provId = clan.capital;
        g.status = age < 15 ? 'child' : 'active';
        g.loyalty = (g.id === clan.lordId) ? 100 :
          U.clamp(78 + Math.round((g.giri - 50) / 3) - Math.round(E.compat(g, lord) / 4) + range(-4, 4), 30, 100);
      });
      /* 支城への配置：どの国にも必ず城主を置き、残りを分散させる */
      var own = E.provsOf(ci);
      var pool = E.gensOf(ci).filter(function (g) { return g.id !== clan.lordId; });
      pool.sort(function (a, b) { return (E.stat(b, 'sen') + E.stat(b, 'sei')) - (E.stat(a, 'sen') + E.stat(a, 'sei')); });
      var branches = own.filter(function (p) { return p.id !== clan.capital; });
      var k2 = 0;
      branches.forEach(function (p) { if (pool[k2]) { pool[k2].provId = p.id; k2++; } });
      pool.slice(k2).forEach(function (g, i) {
        if (branches.length && i % 3 === 2) g.provId = branches[i % branches.length].id;
        else g.provId = clan.capital;
      });
    });

    /* --- 当主が没している家は静かに代替わりさせる --- */
    S.clans.forEach(function (c) {
      var l = E.gen(c.lordId);
      if (l && l.status === 'active') return;
      var men = S.generals.filter(function (g) { return g.clanId === c.id && g.status === 'active'; });
      if (!men.length) { c.dead = true; E.provsOf(c.id).forEach(function (p) { p.owner = null; }); return; }
      men.sort(function (a, b) {
        var as = (a.name.indexOf(c.name) === 0 ? 300 : 0) + a.sei + a.sen + a.cha;
        var bs = (b.name.indexOf(c.name) === 0 ? 300 : 0) + b.sei + b.sen + b.cha;
        return bs - as;
      });
      c.lordId = men[0].id;
      men[0].loyalty = 100;
      if (c.capital >= 0) men[0].provId = c.capital;
    });

    /* --- 在野 --- */
    sc.free.forEach(function (f) {
      var g = E.genByName(f[0]), p = E.provByName(f[1]);
      if (!g || !p) return;
      var age = sc.year - g.born;
      if (g.fate < sc.year || age > 74) { g.status = 'dead'; return; }
      g.clanId = -1; g.provId = p.id;
      g.status = age < 15 ? 'child' : 'free';
      g.loyalty = 0;
    });

    /* --- 未配置の武将は死亡扱い（そのシナリオには登場しない） --- */
    S.generals.forEach(function (g) { if (g.status === 'none') g.status = 'dead'; });

    /* --- 宝物の配置 --- */
    sc.treasures.forEach(function (t) {
      var tr = null;
      for (var k = 0; k < S.treasures.length; k++) if (S.treasures[k].name === t[0]) tr = S.treasures[k];
      if (!tr) return;
      var clan = E.clanByName(t[1]);
      tr.hidden = 0;
      if (clan) {
        var lord = E.gen(clan.lordId);
        if (lord && lord.status === 'active') { tr.owner = lord.id; lord.items.push(tr.id); return; }
      }
      tr.owner = -1; tr.hidden = 1;
    });
    /* 未所持の宝物は各地に埋もれさせる */
    S.treasures.forEach(function (tr) {
      if (tr.owner < 0) { tr.hidden = 1; tr.prov = rnd(S.provinces.length); }
    });

    /* --- 城主・初期資源 --- */
    S.provinces.forEach(function (p) {
      if (p.owner == null) {           /* 空白地 */
        p.hei = range(400, 1200); p.rice = range(600, 1600); p.gold = range(100, 400);
        p.training = range(25, 45); p.minchu = range(45, 65);
        return;
      }
      var c = E.clan(p.owner);
      p.hei = Math.round(E.maxHei(p) * (0.30 + rng() * 0.22));
      p.rice = Math.round(p.koku * (2.4 + rng() * 1.4));
      p.gold = Math.round(p.shou * (0.7 + rng() * 0.7));
      p.guns = p.gunLand ? range(150, 420) : Math.round(p.tech * range(1, 4));
      p.horses = p.horseLand ? range(220, 520) : range(20, 160);
      p.training = U.clamp(38 + range(0, 22), 0, 100);
      E.assignLord(p);
      if (p.id === c.capital) p.actMax = 2;
    });

    /* --- 大名の性格 --- */
    S.clans.forEach(function (c) {
      var l = E.gen(c.lordId);
      if (!l) { c.personality = 'balanced'; return; }
      c.personality = l.amb >= 80 ? 'aggressive' : (l.sei >= 78 ? 'builder' : (l.edu >= 80 ? 'culture' : (l.giri >= 80 ? 'loyal' : 'balanced')));
    });

    var pc = E.clanByName(clanName);
    S.playerClan = pc ? pc.id : 0;
    S.clans[S.playerClan].isPlayer = true;

    E.log('【' + sc.name + '】' + S.year + '年 ' + DATA.seasons[S.season] + '。' + S.clans[S.playerClan].name + '家の物語がはじまる。', 'big');
    E.startSeason();
    return S;
  };

  /* 城主を（再）決定：その国にいる武将で最も相応しい者 */
  E.assignLord = function (p) {
    if (p.owner == null) { p.lordGen = -1; return; }
    var men = E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
    if (!men.length) { p.lordGen = -1; return; }
    var clan = E.clan(p.owner);
    if (men.some(function (g) { return g.id === clan.lordId; })) { p.lordGen = clan.lordId; return; }
    men.sort(function (a, b) {
      return (E.stat(b, 'sei') + E.stat(b, 'sen') + b.loyalty) - (E.stat(a, 'sei') + E.stat(a, 'sen') + a.loyalty);
    });
    p.lordGen = men[0].id;
  };

  /* ============================ 季節の開始 ============================= */
  E.startSeason = function () {
    S.provinces.forEach(function (p) {
      p.acted = 0;
      p.actMax = 1;
      if (p.owner != null) {
        var c = E.clan(p.owner);
        if (c && p.id === c.capital) p.actMax = 2;
        var lg = E.gen(p.lordGen);
        if (lg && E.stat(lg, 'sei') >= 85) p.actMax += 1;
      }
    });
    S.generals.forEach(function (g) { if (g.tired > 0) g.tired--; });
    S.turnPhase = 'player';
  };

  /* ============================ 収入・収穫 ============================= */
  function seasonIncome(p) {
    var c = E.clan(p.owner);
    var lord = E.gen(p.lordGen);
    var seiBonus = lord ? (0.85 + E.stat(lord, 'sei') / 400) : 0.85;
    var gold = p.shou * 0.42 * (0.55 + p.minchu / 240) * (1 + p.culture / 420) * seiBonus;
    gold += p.mine * 90 * (0.8 + rng() * 0.5);
    if (p.port) gold += 30 + p.shou * 0.05;
    if (p.ikki > 0) gold *= 0.4;
    p.gold += Math.round(gold);
  }

  function harvest(p) {
    var lord = E.gen(p.lordGen);
    var seiBonus = lord ? (0.85 + E.stat(lord, 'sei') / 400) : 0.85;
    var w = S.weather;                       /* 0.7(凶作) - 1.3(豊作) */
    var r = p.koku * 4.0 * (0.72 + p.chisui / 260) * (0.6 + p.minchu / 250) * seiBonus * w;
    if (p.ikki > 0) r *= 0.35;
    p.rice += Math.round(r);
  }

  function upkeep(p) {
    /* 兵糧消費 */
    var eat = Math.round(p.hei / 20) + Math.round(E.gensIn(p.id).length * 4);
    p.rice -= eat;
    if (p.rice < 0) {
      var lack = -p.rice; p.rice = 0;
      var lost = Math.min(p.hei, lack * 12);
      p.hei -= lost;
      p.minchu = U.clamp(p.minchu - 4, 0, 100);
      if (lost > 100 && p.owner === S.playerClan) {
        E.log(p.name + 'は兵糧が尽き、' + U.num(lost) + 'の兵が逃散した。', 'bad');
      }
    }
    /* 民忠の自然変動：低いと回復、高すぎると弛緩する */
    var drift = 0;
    var lord = E.gen(p.lordGen);
    var natural = 52 + (lord ? Math.round((E.stat(lord, 'sei') + lord.cha - 110) / 6) : -8);
    natural += Math.round(p.culture / 12) + Math.round((p.koku - p.baseKoku) / 60);
    natural = U.clamp(natural, 20, 92);
    drift += p.minchu < natural ? 1 : (p.minchu > natural + 6 ? -1 : 0);
    if (p.ikki > 0) drift -= 4;
    if (p.rice <= 0) drift -= 2;
    p.minchu = U.clamp(p.minchu + drift, 0, 100);
    /* 訓練の低下 */
    p.training = U.clamp(p.training - 1, 0, 100);
  }

  /* ============================== 天候 ================================= */
  function rollWeather() {
    var r = rng();
    if (r < 0.10) { S.weather = 0.62; S.weatherName = '大凶作'; }
    else if (r < 0.26) { S.weather = 0.82; S.weatherName = '不作'; }
    else if (r < 0.74) { S.weather = 1.00; S.weatherName = '平年'; }
    else if (r < 0.92) { S.weather = 1.16; S.weatherName = '豊作'; }
    else { S.weather = 1.32; S.weatherName = '大豊作'; }
  }

  /* ============================== 事件 ================================= */
  function randomEvents() {
    /* 相場の変動 */
    S.ricePrice = U.clamp(Math.round(S.ricePrice + range(-6, 6) + (S.weather < 0.9 ? 8 : S.weather > 1.1 ? -6 : 0)), 14, 78);
    S.gunPrice = U.clamp(Math.round(S.gunPrice + range(-3, 3)), 16, 55);
    S.horsePrice = U.clamp(Math.round(S.horsePrice + range(-2, 2)), 10, 38);

    S.provinces.forEach(function (p) {
      if (p.owner == null) return;
      var mine = p.owner === S.playerClan;

      /* 一揆 */
      if (p.ikki > 0) {
        p.ikki--;
        if (p.ikki === 0 && mine) E.log(p.name + 'の一揆は鎮まった。', 'good');
        return;
      }
      var ikkiRisk = (42 - p.minchu) / 100;
      if (p.minchu < 38 && rng() < ikkiRisk * 0.55) {
        p.ikki = range(1, 2);
        p.hei = Math.round(p.hei * 0.9);
        E.log(p.name + 'で一揆が蜂起した！', mine ? 'bad' : '');
        return;
      }
      /* 洪水 */
      if (S.season === 1 && rng() < (100 - p.chisui) / 700) {
        var dmg = Math.round(p.koku * 0.06);
        p.koku -= dmg; p.minchu = U.clamp(p.minchu - 6, 0, 100);
        E.log(p.name + 'を洪水が襲い、田畑が流された。', mine ? 'bad' : '');
        return;
      }
      /* 火災 */
      if (S.season === 3 && rng() < 0.02) {
        p.shou = Math.round(p.shou * 0.92);
        E.log(p.name + 'の城下で火事があった。', mine ? 'bad' : '');
        return;
      }
      /* 疫病 */
      if (rng() < 0.012) {
        p.hei = Math.round(p.hei * 0.9); p.minchu = U.clamp(p.minchu - 4, 0, 100);
        E.log(p.name + 'に疫病が流行した。', mine ? 'bad' : '');
        return;
      }
      /* 南蛮船 */
      if (p.port && rng() < 0.03) {
        p.tech = U.clamp(p.tech + range(2, 5), 0, 100);
        p.gold += range(120, 340);
        E.log(p.name + 'に南蛮船が来航した。技術と交易の利を得る。', mine ? 'good' : '');
      }
    });
  }

  /* 年齢による死・元服 */
  function lifeAndDeath() {
    S.generals.forEach(function (g) {
      if (g.status === 'child') {
        if (S.year - g.born >= 15) {
          var cc = E.clan(g.clanId);
          if (!cc || cc.dead || !E.provsOf(g.clanId).length) { g.clanId = -1; }
          g.status = g.clanId >= 0 ? 'active' : 'free';
          if (g.clanId >= 0) {
            var lord = E.lordOf(g.clanId);
            g.loyalty = U.clamp(80 + Math.round((g.giri - 50) / 3) - Math.round(E.compat(g, lord) / 4), 40, 100);
            if (g.clanId === S.playerClan) E.log(g.name + 'が元服し、家中に加わった。', 'good');
          }
        }
        return;
      }
      if (g.status === 'dead' || g.status === 'captive') return;
      var age = S.year - g.born;
      var die = false;
      if (S.year > g.fate) die = rng() < 0.30 + (S.year - g.fate) * 0.10;
      else if (age > 60) die = rng() < (age - 60) * 0.006;
      if (age > 82) die = true;
      if (die) E.killGeneral(g, '病没');
    });
  }

  E.killGeneral = function (g, reason) {
    var wasLord = false, clan = E.clan(g.clanId);
    if (clan && clan.lordId === g.id) wasLord = true;
    g.status = 'dead';
    g.items.forEach(function (ti) {
      var t = S.treasures[ti];
      if (t) { t.owner = -1; t.hidden = 1; t.prov = g.provId; }
    });
    g.items = [];
    if (g.clanId === S.playerClan || wasLord) {
      E.log(g.name + 'が' + reason + 'した。享年' + (S.year - g.born) + '。', g.clanId === S.playerClan ? 'bad' : '');
    }
    if (wasLord) E.succeed(clan);
    g.clanId = -1;
  };

  /* 家督相続 */
  E.succeed = function (clan) {
    var men = E.gensOf(clan.id).filter(function (g) { return g.id !== clan.lordId; });
    if (!men.length) { E.destroyClan(clan, '当主を失い'); return; }
    /* 同姓＞忠誠＞能力 */
    var sur = clan.name;
    men.sort(function (a, b) {
      var as = (a.name.indexOf(sur) === 0 ? 300 : 0) + a.loyalty * 1.5 + a.sei + a.sen + a.cha;
      var bs = (b.name.indexOf(sur) === 0 ? 300 : 0) + b.loyalty * 1.5 + b.sei + b.sen + b.cha;
      return bs - as;
    });
    var heir = men[0];
    clan.lordId = heir.id;
    heir.loyalty = 100;
    E.log(clan.name + '家の家督は' + heir.name + 'が継いだ。', clan.id === S.playerClan ? 'big' : '');
    /* 相性の悪い家臣は離反しやすくなる */
    E.gensOf(clan.id).forEach(function (g) {
      if (g.id === heir.id) return;
      g.loyalty = U.clamp(g.loyalty - Math.round(E.compat(g, heir) / 5) + Math.round((g.giri - 50) / 8), 5, 100);
    });
    var lp = E.provsOf(clan.id);
    if (lp.length) { clan.capital = lp[0].id; heir.provId = lp[0].id; lp.forEach(E.assignLord); }
  };

  E.destroyClan = function (clan, why) {
    if (clan.dead) return;
    clan.dead = true;
    E.provsOf(clan.id).forEach(function (p) { p.owner = null; p.lordGen = -1; });
    E.gensOf(clan.id).forEach(function (g) { g.clanId = -1; g.status = 'free'; g.loyalty = 0; });
    S.generals.forEach(function (g) { if (g.clanId === clan.id && g.status === 'child') g.clanId = -1; });
    E.log('◆ ' + clan.name + '家は' + (why || '') + '滅亡した。', 'big');
    if (clan.id === S.playerClan) { S.ended = true; S.over = 'lose'; }
  };

  /* 忠誠の変動と離反 */
  function loyaltyPhase() {
    S.clans.forEach(function (c) {
      if (c.dead) return;
      var lord = E.gen(c.lordId);
      var owned = E.provsOf(c.id).length;
      E.gensOf(c.id).forEach(function (g) {
        if (g.id === c.lordId) { g.loyalty = 100; return; }
        var d = 0;
        d += (g.giri - 55) / 25;
        d -= (g.amb - 50) / 30;
        d -= E.compat(g, lord) / 22;
        if (g.items.length) d += 0.7;
        var p = E.prov(g.provId);
        if (p && p.lordGen === g.id) d += 0.6;
        if (p && p.minchu > 70) d += 0.3;
        if (owned <= 1) d -= 0.6;
        g.loyalty = U.clamp(g.loyalty + d, 1, 100);
        /* 出奔・離反 */
        if (g.loyalty < 22 && rng() < (26 - g.loyalty) / 130) {
          var tgt = null;
          if (g.amb > 60) {
            var nb = [];
            (E.prov(g.provId) || { adj: [] }).adj.forEach(function (aid) {
              var q = E.prov(aid);
              if (q.owner != null && q.owner !== c.id && !E.clan(q.owner).dead) nb.push(q.owner);
            });
            if (nb.length) tgt = nb[rnd(nb.length)];
          }
          if (tgt != null && rng() < 0.5) {
            var to = E.clan(tgt), tp = E.provsOf(tgt)[0];
            g.clanId = tgt; g.provId = tp ? tp.id : g.provId; g.loyalty = 60;
            E.log('※ ' + g.name + 'が' + c.name + '家を離れ、' + to.name + '家に走った。', c.id === S.playerClan ? 'bad' : '');
          } else {
            g.clanId = -1; g.status = 'free'; g.loyalty = 0;
            E.log('※ ' + g.name + 'が出奔した。', c.id === S.playerClan ? 'bad' : '');
          }
          if (E.prov(g.provId)) E.assignLord(E.prov(g.provId));
        }
      });
    });
  }

  /* 同盟の期限 */
  function diplomacyPhase() {
    S.clans.forEach(function (c) {
      for (var k in c.ally) {
        c.ally[k]--;
        if (c.ally[k] <= 0) {
          delete c.ally[k];
          var o = E.clan(+k);
          if (o) { delete o.ally[c.id]; if (c.id === S.playerClan || +k === S.playerClan) E.log('※ ' + c.name + '家と' + o.name + '家の同盟が切れた。', 'bad'); }
        }
      }
      for (var k2 in c.truce) { c.truce[k2]--; if (c.truce[k2] <= 0) delete c.truce[k2]; }
    });
  }

  E.allied = function (a, b) {
    var c = E.clan(a); return !!(c && c.ally[b] > 0);
  };
  E.makeAlliance = function (a, b, turns) {
    E.clan(a).ally[b] = turns; E.clan(b).ally[a] = turns;
  };
  E.breakAlliance = function (a, b) {
    delete E.clan(a).ally[b]; delete E.clan(b).ally[a];
    E.clan(a).reputation = U.clamp(E.clan(a).reputation - 25, 0, 100);
  };

  /* ============================ 季節送り ============================== */
  E.endSeason = function () {
    rollWeather();
    S.provinces.forEach(function (p) {
      if (p.owner == null) { p.rice += Math.round(p.koku * 1.2); return; }
      if (S.season === 2) harvest(p);
      seasonIncome(p);
      upkeep(p);
    });
    randomEvents();
    loyaltyPhase();
    diplomacyPhase();

    S.season++;
    if (S.season > 3) {
      S.season = 0; S.year++;
      lifeAndDeath();
      S.clans.forEach(function (c) {
        if (c.dead) return;
        if (!E.gensOf(c.id).length && !E.provsOf(c.id).length) E.destroyClan(c, '');
        else if (!E.provsOf(c.id).length) E.destroyClan(c, '所領を失い');
      });
      newYearEvents();
    }
    E.checkVictory();
    E.startSeason();
  };

  function newYearEvents() {
    /* 浪人の流れ／新人の登場 */
    var frees = S.generals.filter(function (g) { return g.status === 'free'; });
    frees.forEach(function (g) {
      if (rng() < 0.12) g.provId = E.prov(g.provId).adj[rnd(E.prov(g.provId).adj.length)];
    });
    /* 文化と技術は隣国へ伝わる */
    var deltaC = {}, deltaT = {};
    S.provinces.forEach(function (p) {
      var bc = 0, bt = 0;
      p.adj.forEach(function (i) {
        var q = S.provinces[i];
        if (q.culture > bc) bc = q.culture;
        if (q.tech > bt) bt = q.tech;
      });
      if (bc > p.culture + 12) deltaC[p.id] = 1 + (bc - p.culture > 30 ? 1 : 0);
      if (bt > p.tech + 12) deltaT[p.id] = 1 + (bt - p.tech > 30 ? 1 : 0);
    });
    S.provinces.forEach(function (p) {
      if (deltaC[p.id]) p.culture = U.clamp(p.culture + deltaC[p.id], 0, 100);
      if (deltaT[p.id]) p.tech = U.clamp(p.tech + deltaT[p.id], 0, 100);
    });
    if (S.year % 3 === 0) {
      S.treasures.forEach(function (t) { if (t.owner < 0 && rng() < 0.15) t.prov = rnd(S.provinces.length); });
    }
  }

  E.checkVictory = function () {
    var alive = E.aliveClans();
    var me = E.clan(S.playerClan);
    if (me.dead) { S.ended = true; S.over = 'lose'; return; }
    var mine = E.provsOf(S.playerClan).length;
    if (mine >= S.provinces.length) { S.ended = true; S.over = 'win'; return; }
    var others = alive.filter(function (c) { return c.id !== S.playerClan && E.provsOf(c.id).length > 0; });
    if (!others.length && mine > 0) {
      var neutral = S.provinces.filter(function (p) { return p.owner == null; }).length;
      if (neutral === 0) { S.ended = true; S.over = 'win'; }
    }
  };

  /* ============================ セーブ／ロード ======================== */
  E.serialize = function () {
    var o = {}, k;
    for (k in S) if (k !== 'rng') o[k] = S[k];
    o.rngState = S.seedVal;
    o.rngCalls = S.rngCalls || 0;
    return JSON.stringify(o);
  };
  E.deserialize = function (json) {
    var o = JSON.parse(json);
    o.rng = U.mulberry32((o.seedVal + (o.year * 977 + o.season * 31)) | 0);
    S = o;
    return S;
  };

})(typeof window !== 'undefined' ? window : globalThis);
