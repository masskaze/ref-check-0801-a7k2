/* =========================================================================
 *  戦国風雲録  —  コマンド（内政・軍事・人事・外交・計略・文化）
 * ========================================================================= */
(function (global) {
  'use strict';
  var NB = global.NB, E = NB.engine, U = NB.util;
  var C = (NB.cmd = {});

  function S() { return E.getState(); }
  function ok(m) { return { ok: true, msg: m }; }
  function ng(m) { return { ok: false, msg: m }; }
  function spend(p, gold, rice) {
    if (gold && p.gold < gold) return false;
    if (rice && p.rice < rice) return false;
    if (gold) p.gold -= gold;
    if (rice) p.rice -= rice;
    return true;
  }
  function use(p) { p.acted++; }
  function skill(g, s) { return E.has(g, s); }

  /* コマンド定義表：UI はここを読んでメニューを組み立てる */
  C.list = [
    { id: 'kaikon',   grp: '内政', name: '開墾',     gold: 320, desc: '田畑を開き石高を上げる' },
    { id: 'chisui',   grp: '内政', name: '治水',     gold: 240, desc: '堤を築き水害に備える' },
    { id: 'shogyo',   grp: '内政', name: '商業',     gold: 320, desc: '市を興し商業を上げる' },
    { id: 'hodokoshi',grp: '内政', name: '施し',     gold: 200, desc: '民に施し民忠を上げる' },
    { id: 'chohei',   grp: '軍事', name: '徴兵',     gold: 0,   desc: '領民から兵を募る' },
    { id: 'kunren',   grp: '軍事', name: '訓練',     gold: 120, desc: '兵を鍛え訓練度を上げる' },
    { id: 'fushin',   grp: '軍事', name: '城普請',   gold: 420, desc: '城を修築し防備を固める' },
    { id: 'buygun',   grp: '軍事', name: '鉄砲購入', gold: 0,   desc: '鉄砲を買い入れる' },
    { id: 'buyhorse', grp: '軍事', name: '軍馬購入', gold: 0,   desc: '軍馬を買い入れる' },
    { id: 'buyrice',  grp: '軍事', name: '兵糧購入', gold: 0,   desc: '米を買い入れる' },
    { id: 'sellrice', grp: '軍事', name: '兵糧売却', gold: 0,   desc: '米を売り金に換える' },
    { id: 'gijutsu',  grp: '文化', name: '技術振興', gold: 400, desc: '鉄砲鍛冶を招き技術を上げる' },
    { id: 'bunka',    grp: '文化', name: '文化振興', gold: 400, desc: '文化を興し国を豊かにする' },
    { id: 'chakai',   grp: '文化', name: '茶会',     gold: 150, desc: '茶会を催し家臣の心を掴む' },
    { id: 'tansaku',  grp: '人事', name: '探索',     gold: 100, desc: '国内を探り人材や宝を求める' },
    { id: 'touyou',   grp: '人事', name: '登用',     gold: 200, desc: '在野の武将を召し抱える' },
    { id: 'houbi',    grp: '人事', name: '褒美',     gold: 0,   desc: '金を与え忠誠を高める' },
    { id: 'jouzu',    grp: '人事', name: '城主任命', gold: 0,   desc: '国を治める城主を替える' },
    { id: 'tsuihou',  grp: '人事', name: '追放',     gold: 0,   desc: '家臣を追放する' },
    { id: 'idou',     grp: '軍事', name: '移動',     gold: 0,   desc: '武将を隣国へ移す' },
    { id: 'yusou',    grp: '軍事', name: '輸送',     gold: 0,   desc: '金・米・兵を隣国へ送る' },
    { id: 'doumei',   grp: '外交', name: '同盟',     gold: 0,   desc: '他家と同盟を結ぶ' },
    { id: 'enjo',     grp: '外交', name: '援助',     gold: 0,   desc: '金や米を贈り友好を得る' },
    { id: 'haki',     grp: '外交', name: '同盟破棄', gold: 0,   desc: '同盟を破棄する' },
    { id: 'choutei',  grp: '外交', name: '朝廷工作', gold: 0,   desc: '朝廷に献金し官位を得る' },
    { id: 'ryugen',   grp: '計略', name: '流言',     gold: 250, desc: '敵将の忠誠を下げる' },
    { id: 'sendou',   grp: '計略', name: '扇動',     gold: 300, desc: '敵国に一揆を起こす' },
    { id: 'baishuu',  grp: '計略', name: '調略',     gold: 0,   desc: '敵将を寝返らせる' },
    { id: 'shutsujin',grp: '軍事', name: '出陣',     gold: 0,   desc: '兵を率いて隣国を攻める' }
  ];

  /* ============================ 内政 ================================== */
  C.kaikon = function (p, g) {
    if (p.koku >= E.maxKoku(p)) return ng('これ以上ひらく地がありません。');
    if (!spend(p, 320)) return ng('金が足りません。');
    var v = Math.round(6 + E.stat(g, 'sei') / 7 + E.rnd(6));
    if (skill(g, '内政')) v = Math.round(v * 1.4);
    if (p.ikki > 0) v = Math.round(v * 0.4);
    p.koku = Math.min(E.maxKoku(p), p.koku + v);
    p.minchu = U.clamp(p.minchu - 1, 0, 100);
    use(p);
    return ok(g.name + 'は開墾を進め、' + p.name + 'の石高が' + v + '上がった。');
  };
  C.chisui = function (p, g) {
    if (p.chisui >= 100) return ng('治水はすでに万全です。');
    if (!spend(p, 240)) return ng('金が足りません。');
    var v = Math.round(2 + E.stat(g, 'sei') / 26 + E.rnd(4));
    if (skill(g, '築城')) v += 2;
    p.chisui = U.clamp(p.chisui + v, 0, 100);
    use(p);
    return ok(g.name + 'は堤を築き、治水が' + v + '上がった。');
  };
  C.shogyo = function (p, g) {
    if (p.shou >= E.maxShou(p)) return ng('これ以上市は栄えません。');
    if (!spend(p, 320)) return ng('金が足りません。');
    var v = Math.round(6 + E.stat(g, 'sei') / 7 + E.rnd(6));
    if (skill(g, '内政')) v = Math.round(v * 1.4);
    if (p.port) v = Math.round(v * 1.15);
    if (p.ikki > 0) v = Math.round(v * 0.4);
    p.shou = Math.min(E.maxShou(p), p.shou + v);
    use(p);
    return ok(g.name + 'は市を興し、' + p.name + 'の商業が' + v + '上がった。');
  };
  C.hodokoshi = function (p, g) {
    if (!spend(p, 200)) return ng('金が足りません。');
    var v = Math.round(3 + g.cha / 18 + E.rnd(4));
    if (p.ikki > 0) { p.ikki = 0; v += 4; }
    p.minchu = U.clamp(p.minchu + v, 0, 100);
    use(p);
    return ok(g.name + 'は民に施した。民忠が' + v + '上がった。');
  };

  /* ============================ 軍事 ================================== */
  C.choheiMax = function (p) {
    var space = E.maxHei(p) - p.hei;
    var pool = Math.round(p.koku * 1.6 * (p.minchu / 100) * (p.ikki > 0 ? 0.2 : 1));
    return Math.max(0, Math.min(space, pool));
  };
  C.chohei = function (p, g, n) {
    n = Math.max(0, Math.round(n || 0));
    var mx = C.choheiMax(p);
    if (mx <= 0) return ng('これ以上兵は集まりません。');
    if (n > mx) n = mx;
    var cost = Math.round(n * 0.14);
    if (!spend(p, cost)) return ng('金が足りません。（' + U.num(cost) + '貫必要）');
    var eff = 1 + (g.cha - 55) / 260;
    n = Math.round(n * U.clamp(eff, 0.7, 1.3));
    p.hei += n;
    p.minchu = U.clamp(p.minchu - Math.round(n / (E.maxHei(p) / 14) + 1), 0, 100);
    p.training = U.clamp(Math.round((p.training * (p.hei - n) + 25 * n) / Math.max(1, p.hei)), 0, 100);
    use(p);
    return ok(g.name + 'は' + U.num(n) + 'の兵を集めた。');
  };
  C.kunren = function (p, g) {
    if (p.training >= 100) return ng('兵は十分に鍛えられています。');
    if (!spend(p, 120)) return ng('金が足りません。');
    var v = Math.round(3 + E.stat(g, 'sen') / 15 + E.rnd(4));
    if (skill(g, '騎馬') || skill(g, '鉄砲')) v += 2;
    p.training = U.clamp(p.training + v, 0, 100);
    use(p);
    return ok(g.name + 'は兵を鍛えた。訓練度が' + v + '上がった。');
  };
  C.fushin = function (p, g) {
    if (p.castleLv >= 100) return ng('城はすでに堅固です。');
    if (!spend(p, 420)) return ng('金が足りません。');
    var v = Math.round(2 + E.stat(g, 'sei') / 30 + E.rnd(4));
    if (skill(g, '築城')) v = Math.round(v * 1.8);
    p.castleLv = U.clamp(p.castleLv + v, 0, 100);
    use(p);
    return ok(g.name + 'は城を修築した。城の守りが' + v + '上がった。');
  };
  C.gunPrice = function (p) {
    var base = S().gunPrice;
    if (p.gunLand) base = Math.round(base * 0.62);
    base = Math.round(base * (1.25 - p.tech / 260));
    return Math.max(8, base);
  };
  C.buygun = function (p, g, n) {
    n = Math.max(0, Math.round(n || 0));
    var mx = E.maxGun(p) - p.guns;
    if (mx <= 0) return ng('これ以上鉄砲は蓄えられません。');
    if (n > mx) n = mx;
    var price = C.gunPrice(p), cost = n * price;
    if (!spend(p, cost)) return ng('金が足りません。（1挺' + price + '貫）');
    p.guns += n; use(p);
    return ok(g.name + 'は鉄砲' + U.num(n) + '挺を買い入れた。（' + U.num(cost) + '貫）');
  };
  C.horsePrice = function (p) { return Math.max(6, Math.round(S().horsePrice * (p.horseLand ? 0.6 : 1))); };
  C.buyhorse = function (p, g, n) {
    n = Math.max(0, Math.round(n || 0));
    var mx = E.maxHorse(p) - p.horses;
    if (mx <= 0) return ng('厩に空きがありません。');
    if (n > mx) n = mx;
    var price = C.horsePrice(p), cost = n * price;
    if (!spend(p, cost)) return ng('金が足りません。（1頭' + price + '貫）');
    p.horses += n; use(p);
    return ok(g.name + 'は軍馬' + U.num(n) + '頭を買い入れた。（' + U.num(cost) + '貫）');
  };
  C.buyrice = function (p, g, koku) {
    koku = Math.max(0, Math.round(koku || 0));
    var price = S().ricePrice, cost = Math.round(koku * price / 100);
    if (!spend(p, cost)) return ng('金が足りません。（100石' + price + '貫）');
    p.rice += koku; use(p);
    return ok('米' + U.num(koku) + '石を' + U.num(cost) + '貫で買い入れた。');
  };
  C.sellrice = function (p, g, koku) {
    koku = Math.max(0, Math.round(koku || 0));
    if (p.rice < koku) return ng('米が足りません。');
    var price = Math.round(S().ricePrice * 0.9), gain = Math.round(koku * price / 100);
    p.rice -= koku; p.gold += gain; use(p);
    return ok('米' + U.num(koku) + '石を売り' + U.num(gain) + '貫を得た。');
  };

  /* ============================ 文化 ================================== */
  C.gijutsu = function (p, g) {
    if (p.tech >= 100) return ng('技術はすでに極まっています。');
    if (!spend(p, 400)) return ng('金が足りません。');
    var v = Math.round(1 + E.stat(g, 'chi') / 45 + E.rnd(3));
    if (skill(g, '鉄砲')) v += 2;
    if (p.gunLand) v += 1;
    p.tech = U.clamp(p.tech + v, 0, 100);
    use(p);
    return ok(g.name + 'は鉄砲鍛冶を招いた。技術が' + v + '上がった。');
  };
  C.bunka = function (p, g) {
    if (p.culture >= 100) return ng('文化はすでに華やかです。');
    if (!spend(p, 400)) return ng('金が足りません。');
    var v = Math.round(1 + E.stat(g, 'edu') / 34 + E.rnd(3));
    if (skill(g, '茶道')) v += 2;
    p.culture = U.clamp(p.culture + v, 0, 100);
    p.minchu = U.clamp(p.minchu + 1, 0, 100);
    use(p);
    return ok(g.name + 'は文化を興した。' + p.name + 'の文化が' + v + '上がった。');
  };
  C.chakaiReady = function (p, g) {
    if (p.culture < 25) return '文化が低くて茶会は開けません。';
    var t = C.bestTeaware(g);
    if (!t) return '茶器がありません。';
    return null;
  };
  C.bestTeaware = function (g) {
    var best = null, st = S();
    g.items.forEach(function (i) {
      var t = st.treasures[i];
      if (t && t.kind === '茶器' && (!best || t.value > best.value)) best = t;
    });
    return best;
  };
  C.chakai = function (p, g) {
    var err = C.chakaiReady(p, g);
    if (err) return ng(err);
    if (!spend(p, 150)) return ng('金が足りません。');
    var t = C.bestTeaware(g);
    var men = E.gensIn(p.id).filter(function (x) { return x.clanId === p.owner; });
    var base = 2 + t.value / 22 + E.stat(g, 'edu') / 28;
    var names = [];
    men.forEach(function (x) {
      if (x.id === g.id) return;
      var v = Math.round(base * (0.6 + x.edu / 130) - E.compat(x, g) / 26);
      v = U.clamp(v, 0, 14);
      if (v > 0) { x.loyalty = U.clamp(x.loyalty + v, 1, 100); names.push(x.name + '+' + v); }
    });
    p.culture = U.clamp(p.culture + 1, 0, 100);
    use(p);
    return ok(g.name + 'は' + t.name + 'をもって茶会を催した。' + (names.length ? '（' + names.join('　') + '）' : '（客は来なかった）'));
  };

  /* ============================ 人事 ================================== */
  C.tansaku = function (p, g) {
    if (!spend(p, 100)) return ng('金が足りません。');
    use(p);
    var st = S(), chi = E.stat(g, 'chi'), r = E.rng();
    /* 宝物発見 */
    var hidden = st.treasures.filter(function (t) { return t.owner < 0 && t.prov === p.id; });
    if (hidden.length && r < 0.22 + chi / 500) {
      var t = hidden[E.rnd(hidden.length)];
      t.owner = g.id; t.hidden = 0; g.items.push(t.id);
      g.loyalty = U.clamp(g.loyalty + 3, 1, 100);
      return ok('◆ ' + g.name + 'は' + t.name + 'を掘り出した！');
    }
    /* 在野武将発見 */
    var free = E.freeGensIn(p.id).filter(function (x) { return !x.found; });
    if (free.length && r < 0.55) {
      var f = free[E.rnd(free.length)];
      f.found = 1;
      return ok('◆ ' + p.name + 'に' + f.name + 'なる者がいると知れた。');
    }
    /* 隠し田・献金 */
    if (r < 0.72) {
      var gold = Math.round(60 + chi * 2 + E.rnd(160));
      p.gold += gold;
      return ok(g.name + 'は隠し田を見つけ、' + U.num(gold) + '貫を得た。');
    }
    if (r < 0.85) {
      p.minchu = U.clamp(p.minchu + 2, 0, 100);
      return ok(g.name + 'は民情を視察した。民忠が2上がった。');
    }
    return ok(g.name + 'は国中を探ったが、何も見つからなかった。');
  };

  C.touyouChance = function (p, g, target) {
    var lord = E.lordOf(p.owner);
    var base = 24 + (g.cha - 50) * 0.5 + (lord ? (lord.cha - 50) * 0.5 : 0);
    base -= E.compat(target, lord) * 0.7;
    base -= (target.amb - 50) * 0.25;
    base += (100 - target.giri) * 0.05;
    base += E.provsOf(p.owner).length * 0.8;
    base += E.clan(p.owner).courtRank * 3;
    if (skill(g, '弁舌')) base += 12;
    if (target.status === 'active') base -= 30 + target.loyalty * 0.6;
    return U.clamp(Math.round(base), 3, 95);
  };
  C.touyou = function (p, g, target) {
    if (!target || target.status !== 'free') return ng('その者は在野ではありません。');
    if (!spend(p, 200)) return ng('金が足りません。');
    use(p);
    var ch = C.touyouChance(p, g, target);
    if (E.rnd(100) < ch) {
      target.clanId = p.owner; target.provId = p.id; target.status = 'active';
      var lord = E.lordOf(p.owner);
      target.loyalty = U.clamp(62 + Math.round((target.giri - 50) / 3) - Math.round(E.compat(target, lord) / 4), 25, 92);
      E.assignLord(p);
      return ok('◆ ' + target.name + 'が家中に加わった！');
    }
    return ng(target.name + 'は召し抱えに応じなかった。（成功率' + ch + '%）');
  };
  C.houbi = function (p, g, target, gold) {
    gold = Math.max(0, Math.round(gold || 0));
    if (!target || target.clanId !== p.owner) return ng('家臣ではありません。');
    if (!spend(p, gold)) return ng('金が足りません。');
    use(p);
    var v = Math.round(gold / 60 + (g.cha - 50) / 20);
    v = U.clamp(v, 0, 26);
    target.loyalty = U.clamp(target.loyalty + v, 1, 100);
    return ok(target.name + 'に' + U.num(gold) + '貫を与えた。忠誠が' + v + '上がった。');
  };
  C.giveItem = function (p, from, to, tid) {
    var t = S().treasures[tid];
    if (!t || t.owner !== from.id) return ng('その宝物は持っていません。');
    from.items = from.items.filter(function (i) { return i !== tid; });
    to.items.push(tid); t.owner = to.id;
    var v = U.clamp(Math.round(t.value / 8 + 3), 3, 18);
    to.loyalty = U.clamp(to.loyalty + v, 1, 100);
    return ok(to.name + 'に' + t.name + 'を与えた。忠誠が' + v + '上がった。');
  };
  C.jouzu = function (p, target) {
    if (!target || target.clanId !== p.owner || target.provId !== p.id) return ng('その国にいる家臣ではありません。');
    p.lordGen = target.id;
    target.loyalty = U.clamp(target.loyalty + 4, 1, 100);
    use(p);
    return ok(target.name + 'を' + p.name + 'の城主に任じた。');
  };
  C.tsuihou = function (p, target) {
    var clan = E.clan(p.owner);
    if (!target || target.clanId !== p.owner) return ng('家臣ではありません。');
    if (target.id === clan.lordId) return ng('当主は追放できません。');
    target.clanId = -1; target.status = 'free'; target.loyalty = 0;
    target.items.forEach(function (i) { var t = S().treasures[i]; if (t) { t.owner = -1; t.hidden = 1; t.prov = p.id; } });
    target.items = [];
    E.assignLord(p);
    use(p);
    return ok(target.name + 'を追放した。');
  };

  /* ============================ 移動・輸送 ============================ */
  C.idou = function (p, g, toId) {
    var q = E.prov(toId);
    if (!q || q.owner !== p.owner) return ng('自国ではありません。');
    if (p.adj.indexOf(toId) < 0) return ng('隣国ではありません。');
    var clan = E.clan(p.owner);
    if (g.id === clan.lordId) clan.capital = toId;
    g.provId = toId;
    E.assignLord(p); E.assignLord(q);
    use(p);
    return ok(g.name + 'は' + q.name + 'へ移った。');
  };
  C.yusou = function (p, toId, gold, rice, hei) {
    var q = E.prov(toId);
    if (!q || q.owner !== p.owner) return ng('自国ではありません。');
    if (p.adj.indexOf(toId) < 0) return ng('隣国ではありません。');
    gold = U.clamp(Math.round(gold || 0), 0, p.gold);
    rice = U.clamp(Math.round(rice || 0), 0, p.rice);
    hei = U.clamp(Math.round(hei || 0), 0, p.hei);
    if (hei > E.maxHei(q) - q.hei) hei = Math.max(0, E.maxHei(q) - q.hei);
    if (!gold && !rice && !hei) return ng('送るものがありません。');
    var lossRate = p.sea.indexOf(toId) >= 0 ? 0.06 : 0.02;
    var lost = Math.round(rice * lossRate);
    p.gold -= gold; p.rice -= rice; p.hei -= hei;
    q.gold += gold; q.rice += (rice - lost); q.hei += hei;
    if (hei) q.training = Math.round((q.training * (q.hei - hei) + p.training * hei) / Math.max(1, q.hei));
    use(p);
    return ok(q.name + 'へ金' + U.num(gold) + '・米' + U.num(rice - lost) + '・兵' + U.num(hei) + 'を送った。');
  };

  /* ============================ 外交 ================================== */
  C.doumeiChance = function (from, to, g, gold) {
    var a = E.clan(from), b = E.clan(to);
    var pa = E.clanPower(from), pb = E.clanPower(to);
    var base = 22 + (g ? (E.stat(g, 'sei') + g.cha - 100) * 0.25 : 0);
    base += (gold || 0) / 90;
    base += (pa > pb ? 6 : -4);
    base += a.reputation * 0.22;
    base += a.courtRank * 5;
    if (g && skill(g, '弁舌')) base += 15;
    /* 隣接して緊張している相手ほど渋る */
    var adjacency = 0;
    E.provsOf(from).forEach(function (p) { p.adj.forEach(function (i) { if (E.prov(i).owner === to) adjacency++; }); });
    base -= adjacency * 3;
    var lb = E.lordOf(to);
    if (lb) base -= (lb.amb - 50) * 0.2;
    return U.clamp(Math.round(base), 2, 95);
  };
  C.doumei = function (p, g, toClan, gold) {
    gold = Math.max(0, Math.round(gold || 0));
    var from = p.owner;
    if (toClan === from) return ng('自家とは結べません。');
    if (E.allied(from, toClan)) return ng('すでに同盟しています。');
    if (!spend(p, gold)) return ng('金が足りません。');
    use(p);
    var ch = C.doumeiChance(from, toClan, g, gold);
    if (E.rnd(100) < ch) {
      E.makeAlliance(from, toClan, 12 + E.rnd(9));
      return ok('◆ ' + E.clan(toClan).name + '家と同盟を結んだ！');
    }
    return ng(E.clan(toClan).name + '家は同盟を断った。（成功率' + ch + '%）');
  };
  C.enjo = function (p, toClan, gold, rice) {
    gold = U.clamp(Math.round(gold || 0), 0, p.gold);
    rice = U.clamp(Math.round(rice || 0), 0, p.rice);
    if (!gold && !rice) return ng('贈るものがありません。');
    p.gold -= gold; p.rice -= rice;
    var tp = E.provsOf(toClan)[0];
    if (tp) { tp.gold += gold; tp.rice += rice; }
    var c = E.clan(p.owner);
    c.reputation = U.clamp(c.reputation + Math.round((gold + rice / 3) / 220), 0, 100);
    var tc = E.clan(toClan);
    tc.favor = tc.favor || {};
    tc.favor[p.owner] = (tc.favor[p.owner] || 0) + Math.round((gold + rice / 3) / 100);
    use(p);
    return ok(E.clan(toClan).name + '家に金' + U.num(gold) + '・米' + U.num(rice) + 'を贈った。');
  };
  C.haki = function (p, toClan) {
    if (!E.allied(p.owner, toClan)) return ng('同盟していません。');
    E.breakAlliance(p.owner, toClan);
    E.clan(toClan).truce[p.owner] = 0;
    use(p);
    return ok(E.clan(toClan).name + '家との同盟を破棄した。（信用が下がった）');
  };
  C.choutei = function (p, g, gold) {
    gold = Math.max(0, Math.round(gold || 0));
    var c = E.clan(p.owner);
    if (c.courtRank >= 5) return ng('これ以上の官位は望めません。');
    if (!spend(p, gold)) return ng('金が足りません。');
    use(p);
    var need = 800 + c.courtRank * 900;
    var ch = U.clamp(Math.round(gold / need * 70 + (g ? g.cha / 5 : 0) + (E.provByName('山城').owner === p.owner ? 20 : 0)), 3, 95);
    if (E.rnd(100) < ch) {
      c.courtRank++;
      var ranks = ['', '従五位下', '従四位下', '従三位', '権大納言', '右大臣'];
      E.provsOf(p.owner).forEach(function (q) { q.minchu = U.clamp(q.minchu + 3, 0, 100); });
      return ok('◆ 朝廷より' + ranks[c.courtRank] + 'を賜った！　民の信望が高まった。');
    }
    return ng('献金は届いたが、沙汰はなかった。（成功率' + ch + '%）');
  };

  /* ============================ 計略 ================================== */
  function keiryakuChance(g, target, base) {
    var v = base + (E.stat(g, 'chi') - 50) * 0.7;
    if (skill(g, '忍法')) v += 18;
    if (target) v -= E.stat(target, 'chi') * 0.35 + target.loyalty * 0.3;
    return U.clamp(Math.round(v), 3, 92);
  }
  C.ryugen = function (p, g, targetProv, targetGen) {
    if (!spend(p, 250)) return ng('金が足りません。');
    use(p);
    var ch = keiryakuChance(g, targetGen, 62);
    if (E.rnd(100) < ch) {
      var v = Math.round(6 + E.stat(g, 'chi') / 9 + E.rnd(6));
      targetGen.loyalty = U.clamp(targetGen.loyalty - v, 1, 100);
      return ok('◆ 流言は効いた。' + targetGen.name + 'の忠誠が' + v + '下がった。');
    }
    return ng('流言は見破られた。（成功率' + ch + '%）');
  };
  C.sendou = function (p, g, targetProv) {
    if (!spend(p, 300)) return ng('金が足りません。');
    use(p);
    var lord = E.gen(targetProv.lordGen);
    var ch = keiryakuChance(g, null, 40 + (60 - targetProv.minchu) * 0.6 - (lord ? lord.sei * 0.2 : 0));
    if (E.rnd(100) < ch) {
      targetProv.ikki = E.range(1, 2);
      targetProv.minchu = U.clamp(targetProv.minchu - 12, 0, 100);
      targetProv.hei = Math.round(targetProv.hei * 0.92);
      return ok('◆ ' + targetProv.name + 'で一揆が起こった！');
    }
    return ng('扇動は失敗した。（成功率' + ch + '%）');
  };
  C.baishuu = function (p, g, targetGen, gold) {
    gold = Math.max(0, Math.round(gold || 0));
    if (!spend(p, gold)) return ng('金が足りません。');
    use(p);
    var tc = E.clan(targetGen.clanId);
    if (tc && tc.lordId === targetGen.id) return ng('当主は調略できません。');
    var ch = keiryakuChance(g, targetGen, 8 + gold / 55 + (targetGen.amb - 50) * 0.4);
    if (E.rnd(100) < ch) {
      var tp = E.prov(targetGen.provId);
      var tookProv = false;
      /* 城主で単独在城なら国ごと寝返る */
      if (tp && tp.lordGen === targetGen.id && E.gensIn(tp.id).filter(function (x) { return x.clanId === tc.id; }).length === 1 && E.rng() < 0.55) {
        E.transferProvince(tp.id, p.owner);
        tookProv = true;
      }
      targetGen.clanId = p.owner;
      targetGen.loyalty = U.clamp(45 + (100 - targetGen.amb) / 4, 20, 80);
      if (!tookProv) targetGen.provId = p.id;
      if (tp) E.assignLord(tp);
      E.assignLord(p);
      if (tc && !E.provsOf(tc.id).length) E.destroyClan(tc, '');
      return ok('◆ ' + targetGen.name + 'が寝返った！' + (tookProv ? '　' + tp.name + 'は我が手に落ちた！' : ''));
    }
    return ng(targetGen.name + 'は調略に応じなかった。（成功率' + ch + '%）');
  };

  /* ==================== 国の移譲（戦・調略の結果） ==================== */
  E.transferProvince = function (pid, newOwner) {
    var p = E.prov(pid), old = p.owner;
    p.owner = newOwner;
    p.ikki = 0;
    p.minchu = U.clamp(p.minchu - 10, 0, 100);
    p.lordGen = -1;
    if (old != null) {
      var oc = E.clan(old);
      if (oc && oc.capital === pid) {
        var rest = E.provsOf(old);
        oc.capital = rest.length ? rest[0].id : -1;
        var lord = E.gen(oc.lordId);
        if (lord && lord.status === 'active' && rest.length) lord.provId = oc.capital;
      }
    }
    p.acted = 99;
    E.assignLord(p);
    var nc = E.clan(newOwner);
    if (nc && nc.capital < 0) nc.capital = pid;
    if (old != null) {
      var oc2 = E.clan(old);
      if (oc2 && !oc2.dead && !E.provsOf(old).length) E.destroyClan(oc2, '');
    }
    E.getState().history.taken++;
  };

  /* ==================== コマンド実行の共通入口 ======================== */
  C.exec = function (id, p, g, args) {
    args = args || {};
    switch (id) {
      case 'kaikon': return C.kaikon(p, g);
      case 'chisui': return C.chisui(p, g);
      case 'shogyo': return C.shogyo(p, g);
      case 'hodokoshi': return C.hodokoshi(p, g);
      case 'chohei': return C.chohei(p, g, args.n);
      case 'kunren': return C.kunren(p, g);
      case 'fushin': return C.fushin(p, g);
      case 'buygun': return C.buygun(p, g, args.n);
      case 'buyhorse': return C.buyhorse(p, g, args.n);
      case 'buyrice': return C.buyrice(p, g, args.n);
      case 'sellrice': return C.sellrice(p, g, args.n);
      case 'gijutsu': return C.gijutsu(p, g);
      case 'bunka': return C.bunka(p, g);
      case 'chakai': return C.chakai(p, g);
      case 'tansaku': return C.tansaku(p, g);
      case 'touyou': return C.touyou(p, g, args.target);
      case 'houbi': return C.houbi(p, g, args.target, args.n);
      case 'jouzu': return C.jouzu(p, args.target);
      case 'tsuihou': return C.tsuihou(p, args.target);
      case 'idou': return C.idou(p, g, args.to);
      case 'yusou': return C.yusou(p, args.to, args.gold, args.rice, args.hei);
      case 'doumei': return C.doumei(p, g, args.clan, args.n);
      case 'enjo': return C.enjo(p, args.clan, args.gold, args.rice);
      case 'haki': return C.haki(p, args.clan);
      case 'choutei': return C.choutei(p, g, args.n);
      case 'ryugen': return C.ryugen(p, g, args.prov, args.target);
      case 'sendou': return C.sendou(p, g, args.prov);
      case 'baishuu': return C.baishuu(p, g, args.target, args.n);
      default: return ng('不明な命令です。');
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
