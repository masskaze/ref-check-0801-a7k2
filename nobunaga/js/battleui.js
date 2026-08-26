/* =========================================================================
 *  戦国風雲録  —  合戦画面
 * ========================================================================= */
(function (global) {
  'use strict';
  var NB = global.NB, E = NB.engine, B = NB.battle, UI = NB.ui, U = NB.util;
  var BU = (NB.battleUI = {});
  var $ = UI.$, $$ = UI.$$, el = UI.el;

  var b = null, mySide = 0, selU = -1, subMode = null, onDone = null, busy = false;
  var cells = [], unitEls = {};

  BU.open = function (battle, playerSide, done) {
    b = battle; mySide = playerSide; onDone = done || null;
    selU = -1; subMode = null; busy = false;
    buildField();
    $('#battle').classList.add('show');
    $('#btlTitle').textContent = E.prov(b.prov).name + '　攻防';
    render();
    renderLog(true);
    if (b.side !== mySide) setTimeout(aiPhase, 500);
  };

  function close() {
    $('#battle').classList.remove('show');
    b = null;
  }

  /* --------------------------- 盤面の生成 ---------------------------- */
  function buildField() {
    var f = $('#btlField');
    f.innerHTML = '';
    cells = []; unitEls = {};
    for (var y = 0; y < B.H; y++) {
      for (var x = 0; x < B.W; x++) {
        var t = B.TERR[b.map[B.idx(x, y)]];
        var c = el('div', 'bc ' + t.cls, t.ch);
        c.style.left = (x * 49) + 'px'; c.style.top = (y * 49) + 'px';
        c.dataset.x = x; c.dataset.y = y;
        c.onclick = (function (x, y) { return function () { clickCell(x, y); }; })(x, y);
        c.title = t.name;
        f.appendChild(c);
        cells[B.idx(x, y)] = c;
      }
    }
    b.units.forEach(function (u) {
      var d = el('div', 'bu s' + u.side);
      d.innerHTML = '<div class="n"></div><div class="t"></div><div class="mo"><i></i></div><div class="hp"><i></i></div>';
      d.onclick = (function (id) { return function (e) { e.stopPropagation(); clickUnit(id); }; })(u.id);
      f.appendChild(d);
      unitEls[u.id] = d;
    });
  }

  /* --------------------------- 描画 ---------------------------------- */
  function render() {
    if (!b) return;
    $('#btlTurn').textContent = b.turn + '／' + b.maxTurn + 'ターン　' +
      (b.side === 0 ? '寄せ手' : '城方') + 'の手番' + (b.side === mySide ? '（自軍）' : '（敵）');
    $('#btlWind').textContent = b.wind + '風　兵糧 寄' + U.num(Math.max(0, b.atkRice)) + '／城' + U.num(Math.max(0, b.defRice));

    cells.forEach(function (c) { c.classList.remove('mv', 'at', 'fire'); });
    for (var k in b.fires) {
      var xy = k.split(',').map(Number);
      var cc = cells[B.idx(xy[0], xy[1])];
      if (cc) cc.classList.add('fire');
    }

    b.units.forEach(function (u) {
      var d = unitEls[u.id];
      if (!d) return;
      if (!u.alive) { d.style.display = 'none'; return; }
      d.style.display = '';
      d.style.left = (u.x * 49 + 1) + 'px';
      d.style.top = (u.y * 49 + 1) + 'px';
      d.className = 'bu s' + u.side + (u.id === selU ? ' sel' : '') +
        (u.acted && u.side === b.side ? ' done' : '') + (u.state === 'confused' ? ' confused' : '');
      d.querySelector('.n').textContent = u.name.length > 4 ? u.name.slice(0, 4) : u.name;
      d.querySelector('.t').textContent = u.type.charAt(0) + U.num(u.troops);
      d.querySelector('.hp i').style.width = U.clamp(u.troops / u.max * 100, 0, 100) + '%';
      d.querySelector('.mo i').style.width = U.clamp(u.morale, 0, 100) + '%';
      d.title = u.name + '　' + u.type + '　兵' + U.num(u.troops) + '／' + U.num(u.max) + '　士気' + Math.round(u.morale);
    });

    var u2 = selU >= 0 ? b.units[selU] : null;
    if (u2 && u2.alive && u2.side === mySide && b.side === mySide && !u2.acted && !busy) {
      if (subMode) {
        var rng = subMode === 'fire' ? 3 : 4;
        for (var y = 0; y < B.H; y++) for (var x = 0; x < B.W; x++) {
          if (Math.abs(u2.x - x) + Math.abs(u2.y - y) <= rng) {
            var t = B.unitAt(b, x, y);
            if (subMode === 'fire') cells[B.idx(x, y)].classList.add('at');
            else if (t && t.side !== mySide) cells[B.idx(x, y)].classList.add('at');
          }
        }
      } else {
        B.reachable(b, u2).forEach(function (r) { cells[B.idx(r.x, r.y)].classList.add('mv'); });
        B.targets(b, u2).forEach(function (t) { cells[B.idx(t.x, t.y)].classList.add('at'); });
      }
    }
    renderSide();
  }

  function renderSide() {
    var info = $('#btlUnitInfo'), cmds = $('#btlCmds'), roster = $('#btlRoster');
    info.innerHTML = ''; cmds.innerHTML = '';
    var u = selU >= 0 ? b.units[selU] : null;
    if (u && u.alive) {
      var g = B.gen(u);
      var box = el('div', 'uinfo');
      box.innerHTML =
        '<h4>' + u.name + '　<span class="dim" style="font-size:11px">' + u.type + '隊</span></h4>' +
        row('兵', U.num(u.troops) + ' / ' + U.num(u.max)) +
        row('士気', Math.round(u.morale)) +
        row('戦闘', B.stat(u, 'sen')) +
        row('智謀', B.stat(u, 'chi')) +
        row('地形', B.TERR[b.map[B.idx(u.x, u.y)]].name) +
        row('状態', u.state === 'confused' ? '混乱' : (u.acted ? '行動済' : '待機')) +
        (u.type === '鉄砲' ? row('射程', Math.max(2, Math.min(3, 2 + Math.floor(u.tech / 55)))) : '');
      info.appendChild(box);

      if (u.side === mySide && b.side === mySide && !u.acted && !busy) {
        addCmd(cmds, '待機', function () { B.rest(b, u); afterAct(); });
        if (u.type === '騎馬') addCmd(cmds, '突撃', function () { UI.toast('隣の敵を選んでください。', ''); subMode = 'charge'; render(); });
        if (B.canFire(b, u)) addCmd(cmds, '火計', function () { subMode = 'fire'; UI.toast('火を放つ場所を選んでください。', ''); render(); });
        addCmd(cmds, '挑発', function () { subMode = 'taunt'; UI.toast('挑発する相手を選んでください。', ''); render(); });
        if (!b.naiou[mySide]) addCmd(cmds, '内応', function () { subMode = 'naiou'; UI.toast('誘う相手を選んでください。', ''); render(); });
        if (subMode) addCmd(cmds, '取消', function () { subMode = null; render(); });
      }
    } else {
      info.innerHTML = '<div class="uinfo dim">部隊を選んでください。</div>';
    }

    roster.innerHTML = '<h4>部隊</h4>';
    b.units.forEach(function (u2) {
      var r = el('div', 'r s' + u2.side + (u2.alive ? '' : ' gone'));
      r.appendChild(el('div', 'nm', u2.name));
      r.appendChild(el('div', 'dim', u2.type.charAt(0)));
      r.appendChild(el('div', '', U.num(u2.troops)));
      r.appendChild(el('div', 'dim', '士' + Math.round(u2.morale)));
      r.onclick = function () { if (u2.alive) { selU = u2.id; subMode = null; render(); } };
      roster.appendChild(r);
    });
  }
  function row(k, v) { return '<div class="row"><span>' + k + '</span><b>' + v + '</b></div>'; }
  function addCmd(box, label, fn) {
    var btn = el('button', 'btn sm', label);
    btn.onclick = fn;
    box.appendChild(btn);
  }

  function renderLog(all) {
    var box = $('#btlLog');
    if (all) box.innerHTML = '';
    var shown = box.children.length;
    for (var i = shown; i < b.log.length; i++) {
      var d = el('div', b.log[i].k || '', b.log[i].t);
      box.appendChild(d);
    }
    box.scrollTop = box.scrollHeight;
  }

  /* --------------------------- 操作 ---------------------------------- */
  function clickUnit(id) {
    if (!b || busy) return;
    var u = b.units[id];
    if (!u.alive) return;
    var cur = selU >= 0 ? b.units[selU] : null;
    if (subMode && cur && u.side !== mySide) { doSub(cur, u); return; }
    if (cur && cur.side === mySide && b.side === mySide && !cur.acted && u.side !== mySide) {
      if (B.targets(b, cur).indexOf(u) >= 0) { doAttack(cur, u); return; }
    }
    selU = id; subMode = null; render();
  }

  function clickCell(x, y) {
    if (!b || busy) return;
    var u = selU >= 0 ? b.units[selU] : null;
    if (!u || !u.alive) return;
    if (subMode === 'fire') {
      var r = B.fire(b, u, x, y);
      subMode = null;
      if (r.msg) UI.toast(r.msg, r.ok ? '' : 'bad');
      afterAct(); return;
    }
    var t = B.unitAt(b, x, y);
    if (t) { clickUnit(t.id); return; }
    if (u.side !== mySide || b.side !== mySide || u.acted) return;
    if (B.move(b, u, x, y)) { render(); renderLog(); }
  }

  function doSub(u, t) {
    var r = null;
    if (subMode === 'taunt') r = B.taunt(b, u, t);
    else if (subMode === 'naiou') r = B.naiou(b, u, t);
    else if (subMode === 'charge') {
      if (B.dist(u, t) > 1) { UI.toast('隣接していません。', 'bad'); return; }
      subMode = null; doAttack(u, t, 'charge'); return;
    }
    subMode = null;
    if (r && r.msg) UI.toast(r.msg, r.ok ? '' : 'bad');
    afterAct();
  }

  function doAttack(u, t, mode) {
    if (u.type === '騎馬' && B.dist(u, t) === 1 && !mode) {
      UI.modal({
        title: '攻撃', body: '<p>' + t.name + '隊へ、いかに攻めますか。</p>' +
          '<p class="hint">突撃は与える損害が大きくなりますが、こちらの被害も増えます。</p>',
        buttons: [
          { label: 'やめる' },
          { label: '通常攻撃', action: function () { B.attack(b, u, t, 'normal'); afterAct(); } },
          { label: '突撃', cls: 'primary', action: function () { B.attack(b, u, t, 'charge'); afterAct(); } }
        ]
      });
      return;
    }
    B.attack(b, u, t, mode || 'normal');
    afterAct();
  }

  function afterAct() {
    render(); renderLog();
    if (b.over) { setTimeout(showResult, 620); return; }
    var left = B.side(b, mySide).filter(function (u) { return !u.acted; });
    if (!left.length) {
      setTimeout(function () { endPhase(); }, 420);
    }
  }

  /* --------------------------- フェイズ ------------------------------ */
  function endPhase() {
    if (!b || b.over) return;
    selU = -1; subMode = null;
    B.endPhase(b);
    render(); renderLog();
    if (b.over) { setTimeout(showResult, 620); return; }
    if (b.side !== mySide) setTimeout(aiPhase, 420);
  }

  function aiPhase() {
    if (!b || b.over) return;
    busy = true;
    var side = b.side;
    /* 内応の試み */
    if (!b.naiou[side]) {
      var caster = null;
      B.side(b, side).forEach(function (u) { if (!caster && B.stat(u, 'chi') >= 80 && !u.acted) caster = u; });
      if (caster && E.rng() < 0.25) {
        var cand = B.side(b, 1 - side).filter(function (t) { return t.gen >= 0 && E.gen(t.gen).loyalty < 60; });
        if (cand.length) B.naiou(b, caster, cand[0]);
      }
    }
    var list = B.side(b, side).slice();
    list.sort(function (a, c) { return (B.TYPES[c.type].rng - B.TYPES[a.type].rng) || (c.troops - a.troops); });
    var i = 0;
    (function step() {
      if (!b) return;
      if (b.over) { busy = false; render(); renderLog(); setTimeout(showResult, 620); return; }
      if (i >= list.length) {
        busy = false;
        B.endPhase(b);
        render(); renderLog();
        if (b.over) { setTimeout(showResult, 620); return; }
        if (b.side !== mySide) setTimeout(aiPhase, 380);
        return;
      }
      var u = list[i++];
      if (u.alive && !u.acted) B.aiUnit(b, u);
      render(); renderLog();
      setTimeout(step, 230);
    })();
  }

  /* --------------------------- 結果 ---------------------------------- */
  function showResult() {
    if (!b) return;
    var win = b.over.winner;
    var mine = (win === mySide);
    var atkLoss = 0, defLoss = 0;
    b.units.forEach(function (u) {
      var lost = u.max - (u.alive ? u.troops : 0);
      if (u.side === 0) atkLoss += lost; else defLoss += lost;
    });
    var prov = E.prov(b.prov);
    var r = B.resolve(b);
    var html = '<p class="hint">' + (win === 0 ? '寄せ手' : '城方') + 'の勝利　（' + b.over.why + '）</p>' +
      '<table class="tbl"><tr><th></th><th class="n">損害</th><th class="n">残兵</th></tr>' +
      '<tr><td>寄せ手</td><td class="n">' + U.num(atkLoss) + '</td><td class="n">' +
      U.num(b.units.filter(function (u) { return u.side === 0 && u.alive; }).reduce(function (a, u) { return a + u.troops; }, 0)) + '</td></tr>' +
      '<tr><td>城方</td><td class="n">' + U.num(defLoss) + '</td><td class="n">' +
      U.num(b.units.filter(function (u) { return u.side === 1 && u.alive; }).reduce(function (a, u) { return a + u.troops; }, 0)) + '</td></tr>' +
      '</table>';
    if (r.dead.length) html += '<p style="color:#f0a49a">討死：' + r.dead.join('、') + '</p>';
    if (r.captured.length) html += '<p style="color:#e3bd6a">捕虜：' + r.captured.map(function (i) { return E.gen(i).name; }).join('、') + '</p>';
    r.msgs.forEach(function (m) { html += '<p>' + m + '</p>'; });

    E.log('《合戦》' + prov.name + '　' + (win === 0 ? E.clan(b.atkClan).name : (b.defClan != null ? E.clan(b.defClan).name : '土豪')) + 'の勝利', mine ? 'good' : 'bad');
    r.msgs.forEach(function (m) { E.log('　' + m, ''); });

    /* AI 側の捕虜処理 */
    r.captured.forEach(function (gid) {
      var g = E.gen(gid);
      if (!g || g.status !== 'captive') return;
      if (g.captiveOf === E.getState().playerClan) return;
      var rr = E.rng();
      if (rr < 0.45) B.captiveAction(gid, 'hire', g.captiveOf);
      else if (rr < 0.78) B.captiveAction(gid, 'free', g.captiveOf);
      else B.captiveAction(gid, 'kill', g.captiveOf);
      if (g.status === 'captive') B.captiveAction(gid, 'free', g.captiveOf);
    });

    var done = onDone;
    UI.modal({
      title: mine ? '勝利' : '敗北', body: html, buttons: [{
        label: '閉じる', cls: 'primary', action: function () {
          close();
          UI.captives(UI.playerCaptives(), function () {
            E.checkVictory();
            UI.renderAll();
            if (done) done(r);
          });
        }
      }]
    });
  }

  /* --------------------------- ボタン -------------------------------- */
  BU.bind = function () {
    $('#btlEnd').onclick = function () { if (!busy && b && b.side === mySide) endPhase(); };
    $('#btlAuto').onclick = function () {
      if (!b || busy) return;
      UI.confirm('委任', 'この合戦を家臣に委ねますか。以後は自動で進みます。', function () {
        busy = true;
        B.autoRun(b);
        render(); renderLog();
        setTimeout(showResult, 400);
      }, '委ねる');
    };
    $('#btlRetreat').onclick = function () {
      if (!b || busy) return;
      var msg = mySide === 0 ? '兵を退きますか。攻め取ることはできません。' : '城を捨てて落ち延びますか。この国は敵の手に落ちます。';
      UI.confirm('退却', msg, function () {
        B.finish(b, 1 - mySide, mySide === 0 ? '寄せ手退却' : '開城');
        render(); renderLog();
        setTimeout(showResult, 400);
      }, '退く');
    };
  };

})(typeof window !== 'undefined' ? window : globalThis);
