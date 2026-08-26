/* =========================================================================
 *  戦国風雲録  —  大名AI（戦略層）
 * ========================================================================= */
(function (global) {
  'use strict';
  var NB = global.NB, E = NB.engine, C = NB.cmd, B = NB.battle, U = NB.util;
  var AI = (NB.ai = {});

  function S() { return E.getState(); }

  /* 実行に適した武将を選ぶ */
  function pick(p, key, skill) {
    var men = E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
    if (!men.length) return null;
    men.sort(function (a, b) {
      var av = E.stat(a, key) + (skill && E.has(a, skill) ? 25 : 0);
      var bv = E.stat(b, key) + (skill && E.has(b, skill) ? 25 : 0);
      return bv - av;
    });
    return men[0];
  }

  function isFrontier(p) {
    for (var i = 0; i < p.adj.length; i++) {
      var q = E.prov(p.adj[i]);
      if (q.owner !== p.owner) return true;
    }
    return false;
  }
  function threatOf(p) {
    var t = 0;
    p.adj.forEach(function (i) {
      var q = E.prov(i);
      if (q.owner === p.owner) return;
      if (q.owner == null) { t += 200; return; }
      if (E.allied(p.owner, q.owner)) return;
      t += q.hei * (0.6 + q.training / 200) + q.castleLv * 5;
    });
    return t;
  }
  function defenseOf(p) {
    var men = E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
    var lead = 0;
    men.forEach(function (g) { lead = Math.max(lead, E.stat(g, 'sen')); });
    return p.hei * (0.58 + p.training / 175) * (1 + p.castleLv / 85) * (1 + lead / 240) + p.guns * 1.4;
  }
  function attackPower(p, troops) {
    var men = E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
    var lead = 0;
    men.forEach(function (g) { lead = Math.max(lead, E.stat(g, 'sen')); });
    return troops * (0.55 + p.training / 190) * (1 + lead / 240) + Math.min(p.guns, troops / 3) * 1.4;
  }

  /* ------------------------- 内政・軍備の一手 ------------------------ */
  function domesticAction(p, clan) {
    if (!pick(p, 'sei')) return null;
    var pers = clan.personality;
    var frontier = isFrontier(p);
    var g;

    if (p.ikki > 0 || p.minchu < 42) {
      g = pick(p, 'cha');
      if (g && p.gold >= 200) return C.hodokoshi(p, g);
    }
    /* 兵糧不足 */
    var need = Math.round(p.hei / 20) * 5;
    if (p.rice < need && p.gold > 700) {
      g = pick(p, 'sei');
      var buy = Math.min(Math.round((p.gold - 400) * 100 / S().ricePrice), need * 2);
      if (buy > 200 && g) return C.buyrice(p, g, buy);
    }
    /* 余剰米の売却 */
    if (p.rice > need * 8 && p.gold < 400 && S().ricePrice > 38) {
      g = pick(p, 'sei');
      if (g) return C.sellrice(p, g, Math.round(p.rice * 0.25));
    }
    /* 前線の兵備 */
    if (frontier) {
      var th = threatOf(p);
      if (defenseOf(p) < th * 0.9 && C.choheiMax(p) > 300 && p.gold > 300) {
        g = pick(p, 'cha');
        if (g) return C.chohei(p, g, C.choheiMax(p));
      }
      if (p.training < 62 && p.gold > 200) {
        g = pick(p, 'sen', '騎馬');
        if (g) return C.kunren(p, g);
      }
      if (p.castleLv < 55 && p.gold > 900 && E.rng() < 0.4) {
        g = pick(p, 'sei', '築城');
        if (g) return C.fushin(p, g);
      }
      if (p.gold > 1400 && p.guns < E.maxGun(p) * 0.5 && E.rng() < 0.5) {
        g = pick(p, 'sen', '鉄砲');
        var n = Math.min(Math.floor((p.gold - 800) / C.gunPrice(p)), E.maxGun(p) - p.guns);
        if (g && n > 20) return C.buygun(p, g, n);
      }
      if (p.gold > 1200 && p.horses < E.maxHorse(p) * 0.4 && E.rng() < 0.3) {
        g = pick(p, 'sen', '騎馬');
        var nh = Math.min(Math.floor((p.gold - 800) / C.horsePrice(p)), E.maxHorse(p) - p.horses);
        if (g && nh > 20) return C.buyhorse(p, g, nh);
      }
    }
    /* 登用 */
    var free = E.freeGensIn(p.id);
    if (free.length && p.gold > 400 && E.rng() < 0.55) {
      free.sort(function (a, b) { return (b.sei + b.sen + b.chi) - (a.sei + a.sen + a.chi); });
      g = pick(p, 'cha', '弁舌');
      if (g) {
        var r = C.touyou(p, g, free[0]);
        if (r) return r;
      }
    }
    /* 内政 */
    var wantKoku = p.koku < E.maxKoku(p) * 0.92;
    var wantShou = p.shou < E.maxShou(p) * 0.92;
    if (p.gold >= 340 && (wantKoku || wantShou)) {
      g = pick(p, 'sei', '内政');
      var preferShou = (pers === 'builder' || pers === 'culture') ? E.rng() < 0.5 : E.rng() < 0.42;
      if (p.rice < need * 3) preferShou = false;
      if (wantShou && (preferShou || !wantKoku)) return C.shogyo(p, g);
      if (wantKoku) return C.kaikon(p, g);
    }
    if (p.gold >= 260 && p.chisui < 62 && E.rng() < 0.35) {
      g = pick(p, 'sei', '築城');
      return C.chisui(p, g);
    }
    /* 文化・技術 */
    if (p.gold >= 900) {
      if (pers === 'culture' && p.culture < 80 && E.rng() < 0.45) {
        g = pick(p, 'edu', '茶道');
        return C.bunka(p, g);
      }
      if (p.tech < 65 && E.rng() < 0.3) {
        g = pick(p, 'chi', '鉄砲');
        return C.gijutsu(p, g);
      }
    }
    /* 茶会で結束 */
    var host = null;
    E.gensIn(p.id).forEach(function (x) {
      if (x.clanId !== p.owner) return;
      if (C.bestTeaware(x) && !host) host = x;
    });
    if (host && p.gold > 400 && p.culture >= 25 && E.rng() < 0.3) {
      var low = E.gensIn(p.id).some(function (x) { return x.clanId === p.owner && x.loyalty < 72; });
      if (low) return C.chakai(p, host);
    }
    /* 褒美 */
    var unhappy = E.gensIn(p.id).filter(function (x) { return x.clanId === p.owner && x.loyalty < 55 && x.id !== clan.lordId; });
    if (unhappy.length && p.gold > 900) {
      g = E.gen(p.lordGen) || pick(p, 'cha');
      return C.houbi(p, g, unhappy[0], Math.min(600, Math.round(p.gold * 0.35)));
    }
    /* 探索 */
    if (p.gold > 250 && E.rng() < 0.4) {
      g = pick(p, 'chi', '忍法');
      return C.tansaku(p, g);
    }
    if (p.gold >= 340 && wantKoku) {
      g = pick(p, 'sei', '内政');
      return C.kaikon(p, g);
    }
    return null;
  }

  /* --------------------------- 輸送 ---------------------------------- */
  function supplyAction(p, clan) {
    if (isFrontier(p)) return null;
    var best = null, bs = 0;
    p.adj.forEach(function (i) {
      var q = E.prov(i);
      if (q.owner !== p.owner) return;
      var sc = (isFrontier(q) ? 1 : 0) * (threatOf(q) / 400) + (q.gold < 300 ? 1 : 0);
      if (sc > bs) { bs = sc; best = q; }
    });
    if (!best) return null;
    var gold = p.gold > 1200 ? Math.round(p.gold * 0.6) : 0;
    var rice = p.rice > Math.round(p.hei / 20) * 12 ? Math.round(p.rice * 0.4) : 0;
    var hei = 0;
    if (p.hei > E.maxHei(p) * 0.5 && threatOf(best) > defenseOf(best)) hei = Math.round(p.hei * 0.4);
    if (!gold && !rice && !hei) return null;
    return C.yusou(p, best.id, gold, rice, hei);
  }

  /* --------------------------- 計略 ---------------------------------- */
  function plotAction(p, clan) {
    if (p.gold < 900 || E.rng() > 0.30) return null;
    var targets = [];
    p.adj.forEach(function (i) {
      var q = E.prov(i);
      if (q.owner == null || q.owner === p.owner) return;
      if (E.allied(p.owner, q.owner)) return;
      E.gensIn(q.id).forEach(function (g) {
        if (g.clanId !== q.owner) return;
        var qc = E.clan(q.owner);
        if (qc && qc.lordId === g.id) return;
        targets.push({ p: q, g: g });
      });
    });
    if (!targets.length) return null;
    targets.sort(function (a, b) { return a.g.loyalty - b.g.loyalty; });
    var t = targets[0];
    var caster = pick(p, 'chi', '忍法');
    if (!caster) return null;
    if (t.g.loyalty < 42 && p.gold > 2200 && E.rng() < 0.6) {
      return C.baishuu(p, caster, t.g, Math.min(1800, Math.round(p.gold * 0.5)));
    }
    if (E.rng() < 0.45) return C.ryugen(p, caster, t.p, t.g);
    if (t.p.minchu < 60) return C.sendou(p, caster, t.p);
    return null;
  }

  /* --------------------------- 外交 ---------------------------------- */
  function diplomacy(clan) {
    if (E.rng() > 0.30) return;
    var cap = E.prov(clan.capital);
    if (!cap || cap.owner !== clan.id || cap.gold < 900) return;
    var mine = E.clanPower(clan.id);
    var neighbors = {};
    E.provsOf(clan.id).forEach(function (p) {
      p.adj.forEach(function (i) {
        var q = E.prov(i);
        if (q.owner != null && q.owner !== clan.id) neighbors[q.owner] = true;
      });
    });
    var best = null, bs = 0;
    Object.keys(neighbors).forEach(function (k) {
      var cid = +k;
      if (E.allied(clan.id, cid)) return;
      var pw = E.clanPower(cid);
      var sc = pw / Math.max(1, mine);
      if (sc > bs) { bs = sc; best = cid; }
    });
    if (best == null) return;
    /* 自分より強い隣国とは手を結ぶ */
    if (bs > 1.25 || (clan.personality === 'loyal' && bs > 0.9)) {
      var envoy = pick(cap, 'sei', '弁舌');
      if (envoy && cap.acted < cap.actMax) {
        var gift = Math.min(900, Math.round(cap.gold * 0.4));
        C.doumei(cap, envoy, best, gift);
      }
    }
  }

  /* --------------------------- 出陣判断 ------------------------------ */
  function planAttack(p, clan) {
    if (p.acted >= p.actMax) return null;
    if (p.hei < 1200) return null;
    var men = E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
    if (!men.length) return null;
    var aggr = { aggressive: 1.30, balanced: 1.62, builder: 1.85, culture: 2.05, loyal: 1.72 }[clan.personality] || 1.6;
    var lord = E.lordOf(clan.id);
    if (lord) aggr -= (lord.amb - 50) / 260;

    var best = null, bs = -1e9;
    p.adj.forEach(function (i) {
      var q = E.prov(i);
      if (q.owner === p.owner) return;
      if (q.owner != null && E.allied(p.owner, q.owner)) return;
      if (q.owner != null && E.clan(q.owner).dead) return;
      var send = Math.round(p.hei * 0.82);
      var ap = attackPower(p, send), dp = defenseOf(q);
      if (q.owner == null) dp *= 0.8;
      if (ap < dp * aggr) return;
      var value = E.power(q) + (q.owner == null ? 250 : 0) + (E.prov(clan.capital) && q.adj.indexOf(clan.capital) >= 0 ? 150 : 0);
      var sc = value * (ap / Math.max(1, dp));
      if (q.ikki > 0) sc *= 1.4;
      if (sc > bs) { bs = sc; best = q; }
    });
    if (!best) return null;
    var rice = Math.round(p.hei * 0.82 / 6);
    if (p.rice < rice + 400) return null;
    return { to: best, troops: Math.round(p.hei * 0.82), rice: Math.min(p.rice - 200, rice * 2) };
  }

  AI.buildForce = function (p, troops, rice, maxGens) {
    var men = E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
    men.sort(function (a, b) { return (E.stat(b, 'sen') * 2 + E.stat(b, 'chi')) - (E.stat(a, 'sen') * 2 + E.stat(a, 'chi')); });
    men = men.slice(0, maxGens || 6);
    if (!men.length) return null;
    var gunsLeft = p.guns, horseLeft = p.horses;
    var each = Math.floor(troops / men.length);
    var gens = men.map(function (g, i) {
      var type = '足軽';
      if (E.has(g, '鉄砲') && gunsLeft >= each / 3) { type = '鉄砲'; gunsLeft -= Math.round(each / 3); }
      else if (E.has(g, '騎馬') && horseLeft >= each / 4) { type = '騎馬'; horseLeft -= Math.round(each / 4); }
      else if (gunsLeft >= each / 3 && i % 3 === 1) { type = '鉄砲'; gunsLeft -= Math.round(each / 3); }
      else if (horseLeft >= each / 4 && i % 3 === 2) { type = '騎馬'; horseLeft -= Math.round(each / 4); }
      return { gen: g, troops: each, type: type };
    });
    return { gens: gens, rice: rice };
  };

  /* 出陣の実行（守備側が人間なら battle を返す） */
  AI.launch = function (p, plan) {
    var force = AI.buildForce(p, plan.troops, plan.rice);
    if (!force) return null;
    p.hei -= plan.troops;
    p.rice -= plan.rice;
    p.acted = p.actMax;
    var b = B.create(p, plan.to, force, {});
    b.aiLaunched = true;
    return b;
  };

  AI.finishBattle = function (b) {
    var r = B.resolve(b);
    var winner = r.winner === 0 ? b.atkClan : b.defClan;
    var loser = r.winner === 0 ? b.defClan : b.atkClan;
    var prov = E.prov(b.prov);
    if (winner === S().playerClan || loser === S().playerClan || r.taken) {
      E.log('《合戦》' + prov.name + '　' + E.clan(b.atkClan).name + '軍 対 ' + (b.defClan != null ? E.clan(b.defClan).name + '軍' : '土豪') +
        '　→　' + (r.winner === 0 ? E.clan(b.atkClan).name : (b.defClan != null ? E.clan(b.defClan).name : '土豪')) + 'の勝利',
        loser === S().playerClan ? 'bad' : (winner === S().playerClan ? 'good' : ''));
      r.msgs.forEach(function (m) { E.log('　' + m, ''); });
    }
    /* 捕虜の処遇（AI） */
    r.captured.forEach(function (gid) {
      var g = E.gen(gid);
      if (!g || g.status !== 'captive') return;
      var holder = g.captiveOf;
      if (holder === S().playerClan) return;         /* プレイヤーが決める */
      var rr = E.rng();
      if (rr < 0.45) B.captiveAction(gid, 'hire', holder);
      else if (rr < 0.75) B.captiveAction(gid, 'free', holder);
      else B.captiveAction(gid, 'kill', holder);
      if (g.status === 'captive') B.captiveAction(gid, 'free', holder);
    });
    return r;
  };

  /* --------------------------- 進行制御 ------------------------------ */
  AI.begin = function () {
    var st = S();
    var q = [];
    st.clans.forEach(function (c) { if (!c.dead && c.id !== st.playerClan) q.push(c.id); });
    /* 弱い家から動く（強者が後手で調整） */
    q.sort(function (a, b) { return E.clanPower(a) - E.clanPower(b); });
    st.aiQueue = q;
    st.aiStage = 0;
  };

  /* 1家分を処理。プレイヤーが守備側の合戦が起きたら battle を返して中断 */
  AI.stepClan = function () {
    var st = S();
    if (!st.aiQueue || !st.aiQueue.length) return null;
    var cid = st.aiQueue[0];
    var clan = E.clan(cid);
    if (!clan || clan.dead) { st.aiQueue.shift(); return { done: false }; }

    var provs = E.provsOf(cid);
    provs.sort(function (a, b) { return threatOf(b) - threatOf(a); });

    for (var i = 0; i < provs.length; i++) {
      var p = provs[i];
      if (p.owner !== cid) continue;
      /* 出陣 */
      var plan = planAttack(p, clan);
      if (plan) {
        var b = AI.launch(p, plan);
        if (b) {
          if (b.defClan === st.playerClan) return { battle: b };
          B.autoRun(b);
          AI.finishBattle(b);
          continue;
        }
      }
      /* 城主不在なら隣国から武将を呼ぶ */
      if (!E.gensIn(p.id).filter(function (g) { return g.clanId === cid; }).length) {
        for (var k = 0; k < p.adj.length; k++) {
          var q = E.prov(p.adj[k]);
          if (q.owner !== cid || q.acted >= q.actMax) continue;
          var pool = E.gensIn(q.id).filter(function (g) { return g.clanId === cid; });
          if (pool.length < 2) continue;
          pool.sort(function (a, b) { return (E.stat(a, 'sei') + E.stat(a, 'sen')) - (E.stat(b, 'sei') + E.stat(b, 'sen')); });
          C.idou(q, pool[0], p.id);
          break;
        }
      }
      var guard = 0;
      while (p.acted < p.actMax && guard++ < 5) {
        var r = plotAction(p, clan) || domesticAction(p, clan) || supplyAction(p, clan);
        if (!r) break;
      }
    }
    diplomacy(clan);
    st.aiQueue.shift();
    return { done: false };
  };

  AI.run = function () {
    var st = S(), guard = 0;
    while (st.aiQueue && st.aiQueue.length && guard++ < 200) {
      var r = AI.stepClan();
      if (r && r.battle) return r.battle;
    }
    return null;
  };

})(typeof window !== 'undefined' ? window : globalThis);
