/* =========================================================================
 *  戦国風雲録  —  UI（地図・国情報・コマンド）
 * ========================================================================= */
(function (global) {
  'use strict';
  var NB = global.NB, E = NB.engine, C = NB.cmd, B = NB.battle, U = NB.util;
  var UI = (NB.ui = {});
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  UI.$ = $; UI.$$ = $$; UI.el = el;

  var S = function () { return E.getState(); };
  var sel = -1;                 /* 選択中の国 */
  var mode = null;              /* 目標選択モード */
  var zoom = 1, panX = 0, panY = 0;

  UI.selected = function () { return sel; };

  /* ============================ 画面切替 ============================= */
  UI.show = function (id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('show', s.id === id); });
  };

  /* ============================ トースト ============================= */
  UI.toast = function (msg, kind) {
    var t = $('#toast'), d = el('div', kind || '', msg);
    t.appendChild(d);
    setTimeout(function () {
      d.style.transition = 'opacity .4s'; d.style.opacity = '0';
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 420);
    }, 2600);
  };

  /* ============================ モーダル ============================= */
  var modalStack = [];
  UI.modal = function (opt) {
    var m = $('#modal');
    $('#modalTitle').textContent = opt.title || '';
    var body = $('#modalBody'); body.innerHTML = '';
    if (typeof opt.body === 'string') body.innerHTML = opt.body;
    else if (opt.body) body.appendChild(opt.body);
    var foot = $('#modalFoot'); foot.innerHTML = '';
    (opt.buttons || [{ label: '閉じる' }]).forEach(function (b) {
      var btn = el('button', 'btn ' + (b.cls || ''), b.label);
      btn.onclick = function () {
        if (b.action) { if (b.action() === false) return; }
        if (!b.keep) UI.closeModal();
      };
      if (b.disabled) btn.disabled = true;
      foot.appendChild(btn);
      if (b.id) btn.id = b.id;
    });
    m.classList.add('show');
    UI.modalOnClose = opt.onClose || null;
    return body;
  };
  UI.closeModal = function () {
    $('#modal').classList.remove('show');
    var f = UI.modalOnClose; UI.modalOnClose = null;
    if (f) f();
  };

  UI.confirm = function (title, text, onYes, yesLabel) {
    UI.modal({
      title: title, body: '<p>' + text + '</p>',
      buttons: [
        { label: 'やめる' },
        { label: yesLabel || '行う', cls: 'primary', action: onYes }
      ]
    });
  };

  /* ============================ ログ ================================= */
  UI.onLog = function (msg, kind) {
    var list = $('#logList');
    if (!list) return;
    var st = S();
    var d = el('div', kind || '');
    var t = el('span', 't', st.year + '年' + NB.DATA.seasons[st.season]);
    d.appendChild(t);
    d.appendChild(document.createTextNode(msg));
    list.appendChild(d);
    while (list.children.length > 160) list.removeChild(list.firstChild);
    list.parentNode.scrollTop = list.parentNode.scrollHeight;
  };
  UI.renderLog = function () {
    var list = $('#logList'); list.innerHTML = '';
    S().log.slice(-80).forEach(function (l) {
      var d = el('div', l.k || '');
      d.appendChild(el('span', 't', l.y + '年' + NB.DATA.seasons[l.s]));
      d.appendChild(document.createTextNode(l.t));
      list.appendChild(d);
    });
    list.parentNode.scrollTop = list.parentNode.scrollHeight;
  };

  /* ============================ 地図 ================================= */
  var nodes = [];
  UI.buildMap = function () {
    var map = $('#map'), svg = $('#links');
    map.innerHTML = ''; svg.innerHTML = ''; nodes = [];
    var st = S();
    var drawn = {};
    st.provinces.forEach(function (p) {
      p.adj.forEach(function (aid) {
        var key = Math.min(p.id, aid) + '-' + Math.max(p.id, aid);
        if (drawn[key]) return;
        drawn[key] = 1;
        var q = st.provinces[aid];
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', px(p) + 30); line.setAttribute('y1', py(p) + 21);
        line.setAttribute('x2', px(q) + 30); line.setAttribute('y2', py(q) + 21);
        line.setAttribute('stroke', p.sea.indexOf(aid) >= 0 ? '#3a5a7a' : '#3d4a63');
        line.setAttribute('stroke-width', '1.5');
        if (p.sea.indexOf(aid) >= 0) line.setAttribute('stroke-dasharray', '4 4');
        svg.appendChild(line);
      });
    });
    st.provinces.forEach(function (p) {
      var d = el('div', 'pv');
      d.style.left = px(p) + 'px'; d.style.top = py(p) + 'px';
      d.dataset.id = p.id;
      var n = el('div', '', p.name); d.appendChild(n);
      var h = el('div', 'hei', ''); d.appendChild(h);
      d.onclick = function (ev) { ev.stopPropagation(); UI.clickProv(p.id); };
      map.appendChild(d);
      nodes[p.id] = { root: d, hei: h };
    });
    UI.fit();
  };
  function px(p) { return p.x * 58 + 24; }
  function py(p) { return p.y * 56 + 22; }

  UI.renderMap = function () {
    var st = S();
    st.provinces.forEach(function (p) {
      var nd = nodes[p.id]; if (!nd) return;
      var c = p.owner != null ? E.clan(p.owner) : null;
      nd.root.style.background = c ? c.color : '#525a66';
      nd.root.classList.toggle('mine', p.owner === st.playerClan);
      nd.root.classList.toggle('sel', p.id === sel);
      nd.root.classList.toggle('acted', p.owner === st.playerClan && p.acted >= p.actMax);
      nd.root.classList.remove('tgt', 'dimmed');
      nd.hei.textContent = (p.ikki > 0 ? '一揆 ' : '') + U.num(p.hei);
      nd.root.title = p.name + '（' + (c ? c.name + '家' : '無主') + '）城:' + p.castle +
        '  兵' + U.num(p.hei) + ' 石高' + p.koku + ' 商業' + p.shou + ' 民忠' + p.minchu;
    });
    if (mode && mode.targets) {
      st.provinces.forEach(function (p) {
        var nd = nodes[p.id]; if (!nd) return;
        if (mode.targets.indexOf(p.id) >= 0) nd.root.classList.add('tgt');
        else nd.root.classList.add('dimmed');
      });
    }
    var lg = $('#maplegend');
    if (mode) lg.textContent = mode.hint || '目標を選んでください（右クリックで取消）';
    else {
      var mineN = E.provsOf(st.playerClan).length;
      lg.textContent = '自国 ' + mineN + ' か国 ／ 全' + st.provinces.length + 'か国　' + (st.weatherName ? '（' + st.weatherName + '）' : '');
    }
  };

  UI.fit = function () {
    var w = $('#mapwrap').clientWidth, h = $('#mapwrap').clientHeight;
    zoom = Math.min(w / 1500, h / 762, 1.4);
    if (zoom < 0.35) zoom = 0.35;
    panX = (w - 1490 * zoom) / 2; panY = (h - 750 * zoom) / 2;
    applyTransform();
  };
  function applyTransform() {
    $('#mapscale').style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')';
  }
  UI.zoomBy = function (f) {
    var w = $('#mapwrap').clientWidth / 2, h = $('#mapwrap').clientHeight / 2;
    var nz = U.clamp(zoom * f, 0.35, 2.4);
    panX = w - (w - panX) * (nz / zoom);
    panY = h - (h - panY) * (nz / zoom);
    zoom = nz; applyTransform();
  };
  UI.centerOn = function (pid) {
    var p = E.prov(pid);
    var w = $('#mapwrap').clientWidth, h = $('#mapwrap').clientHeight;
    panX = w / 2 - (px(p) + 30) * zoom;
    panY = h / 2 - (py(p) + 21) * zoom;
    applyTransform();
  };

  /* ============================ 上部バー ============================= */
  UI.renderTop = function () {
    var st = S(), c = E.clan(st.playerClan), lord = E.gen(c.lordId);
    $('#tbYear').textContent = st.year + '年';
    $('#tbSeason').textContent = NB.DATA.seasons[st.season];
    $('#tbCrest').style.background = c.color;
    $('#tbClan').textContent = c.name + '家';
    $('#tbLord').textContent = lord ? '／' + lord.name : '';
    var ps = E.provsOf(st.playerClan);
    var gold = 0, rice = 0, hei = 0;
    ps.forEach(function (p) { gold += p.gold; rice += p.rice; hei += p.hei; });
    var rank = ['', '従五位下', '従四位下', '従三位', '権大納言', '右大臣'][c.courtRank] || '';
    $('#tbStats').innerHTML =
      '国 <b>' + ps.length + '</b>' +
      '　兵 <b>' + U.num(hei) + '</b>' +
      '　金 <b>' + U.num(gold) + '</b>' +
      '　米 <b>' + U.num(rice) + '</b>' +
      '　武将 <b>' + E.gensOf(st.playerClan).length + '</b>' +
      '　米相場 <b>' + st.ricePrice + '</b>' +
      (rank ? '　官位 <b>' + rank + '</b>' : '');
  };

  /* ============================ 右パネル ============================= */
  UI.clickProv = function (id) {
    if (mode) { UI.pickTarget(id); return; }
    sel = id;
    UI.renderMap(); UI.renderSide();
    if (window.innerWidth <= 960) $('#side').classList.add('open');
  };

  function statRow(label, val, max, extra) {
    var d = el('div', 'st');
    d.appendChild(el('span', '', label));
    d.appendChild(el('b', '', typeof val === 'number' ? U.num(val) : val));
    if (max) {
      var bar = el('div', 'bar'), i = el('i');
      i.style.width = U.clamp(val / max * 100, 0, 100) + '%';
      bar.appendChild(i); d.appendChild(bar);
    }
    if (extra) d.appendChild(el('span', '', extra));
    return d;
  }

  UI.renderSide = function () {
    var box = $('#provPanel');
    box.innerHTML = '';
    if (sel < 0) { box.appendChild(el('p', 'dim pad', '国をえらんでください。')); return; }
    var st = S(), p = E.prov(sel), c = p.owner != null ? E.clan(p.owner) : null;
    var mine = p.owner === st.playerClan;

    var ph = el('div', 'ph');
    var h3 = el('h3', '', p.name);
    ph.appendChild(h3);
    var ow = el('div', 'owner', (c ? c.name + '家' : '無主') + '／' + p.castle);
    ph.appendChild(ow);
    if (mine) {
      var acts = el('div', 'acts', '命令 ' + Math.max(0, p.actMax - p.acted) + '/' + p.actMax);
      ph.appendChild(acts);
    }
    box.appendChild(ph);

    var sg = el('div', 'stat-grid');
    sg.appendChild(statRow('石高', p.koku, E.maxKoku(p)));
    sg.appendChild(statRow('商業', p.shou, E.maxShou(p)));
    sg.appendChild(statRow('治水', p.chisui, 100));
    sg.appendChild(statRow('民忠', p.minchu, 100));
    sg.appendChild(statRow('技術', p.tech, 100));
    sg.appendChild(statRow('文化', p.culture, 100));
    sg.appendChild(statRow('城', p.castleLv, 100));
    sg.appendChild(statRow('訓練', p.training, 100));
    box.appendChild(sg);

    var sub = el('div', 'sub');
    sub.innerHTML = '兵 <b>' + U.num(p.hei) + '</b>／' + U.num(E.maxHei(p)) +
      '　金 <b>' + U.num(p.gold) + '</b>' +
      '　米 <b>' + U.num(p.rice) + '</b>' +
      '　鉄砲 <b>' + U.num(p.guns) + '</b>' +
      '　馬 <b>' + U.num(p.horses) + '</b>' +
      (p.port ? '　<b>港</b>' : '') + (p.mine ? '　<b>金山</b>' : '') +
      (p.gunLand ? '　<b>鉄砲鍛冶</b>' : '') + (p.horseLand ? '　<b>馬産地</b>' : '') +
      (p.ikki > 0 ? '　<b style="color:#f0a49a">一揆</b>' : '');
    box.appendChild(sub);

    /* 武将一覧 */
    var men = E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
    var frees = E.freeGensIn(p.id);
    var caps = st.generals.filter(function (g) { return g.status === 'captive' && g.provId === p.id; });
    var gl = el('div', 'glist');
    if (men.length) gl.appendChild(el('div', 'ghead', '在城の武将'));
    men.forEach(function (g) { gl.appendChild(genRow(g, p)); });
    if (frees.length) gl.appendChild(el('div', 'ghead', '在野の者'));
    frees.forEach(function (g) {
      var r = genRow(g, p);
      r.classList.add('free');
      r.querySelector('.loy').textContent = g.found ? '在野' : '？';
      gl.appendChild(r);
    });
    if (caps.length) gl.appendChild(el('div', 'ghead', '捕虜'));
    caps.forEach(function (g) {
      var r = genRow(g, p);
      r.querySelector('.loy').textContent = '捕虜';
      gl.appendChild(r);
    });
    if (!men.length && !frees.length) gl.appendChild(el('div', 'grow-row dim', '　武将はいない'));
    box.appendChild(gl);

    if (mine) box.appendChild(commandPanel(p));
    else if (c) {
      var info = el('div', 'pad dim');
      info.innerHTML = '<b>' + c.name + '家</b>　当主：' + (E.gen(c.lordId) ? E.gen(c.lordId).name : '—') +
        '<br>領国 ' + E.provsOf(c.id).length + 'か国　' +
        (E.allied(st.playerClan, c.id) ? '<span style="color:#8fd6a4">同盟中</span>' : '') +
        '<br><br>隣接する自国から〈出陣〉〈計略〉を行えます。';
      box.appendChild(info);
    }
  };

  function genRow(g, p) {
    var st = S();
    var r = el('div', 'grow-row');
    var c = E.clan(g.clanId);
    if (c && c.lordId === g.id) r.classList.add('lordrow');
    if (p && p.lordGen === g.id) r.classList.add('lordrow');
    var nm = el('div', 'nm', g.name);
    r.appendChild(nm);
    var kv = el('div', 'kv', '政' + E.stat(g, 'sei') + ' 戦' + E.stat(g, 'sen') + ' 智' + E.stat(g, 'chi') + ' 教' + E.stat(g, 'edu'));
    r.appendChild(kv);
    if (g.skills.length) r.appendChild(el('div', 'sk', g.skills.join('･')));
    var loy = el('div', 'loy', g.status === 'active' ? ('忠' + Math.round(g.loyalty)) : '');
    r.appendChild(loy);
    r.onclick = function () { UI.generalCard(g); };
    return r;
  }

  UI.generalCard = function (g) {
    var st = S(), c = E.clan(g.clanId);
    var items = g.items.map(function (i) { return st.treasures[i].name + '（' + st.treasures[i].kind + '）'; });
    var html = '<table class="tbl">' +
      '<tr><th>家</th><td>' + (c ? c.name + '家' : (g.status === 'free' ? '在野' : g.status === 'captive' ? '捕虜' : '—')) + '</td>' +
      '<th>年齢</th><td>' + E.age(g) + '歳</td></tr>' +
      '<tr><th>政治</th><td class="n">' + E.stat(g, 'sei') + '</td><th>戦闘</th><td class="n">' + E.stat(g, 'sen') + '</td></tr>' +
      '<tr><th>智謀</th><td class="n">' + E.stat(g, 'chi') + '</td><th>魅力</th><td class="n">' + E.stat(g, 'cha') + '</td></tr>' +
      '<tr><th>教養</th><td class="n">' + E.stat(g, 'edu') + '</td><th>野望</th><td class="n">' + g.amb + '</td></tr>' +
      '<tr><th>義理</th><td class="n">' + g.giri + '</td><th>忠誠</th><td class="n">' + (g.status === 'active' ? Math.round(g.loyalty) : '—') + '</td></tr>' +
      '<tr><th>特技</th><td colspan="3">' + (g.skills.join('・') || 'なし') + '</td></tr>' +
      '<tr><th>所持</th><td colspan="3">' + (items.join('、') || 'なし') + '</td></tr>' +
      '</table>';
    UI.modal({ title: g.name, body: html });
  };

  /* --------------------------- コマンド盤 ---------------------------- */
  function commandPanel(p) {
    var wrap = el('div', 'cmd-groups');
    var groups = {};
    C.list.forEach(function (cd) {
      (groups[cd.grp] = groups[cd.grp] || []).push(cd);
    });
    var order = ['内政', '軍事', '文化', '人事', '外交', '計略'];
    var canAct = p.acted < p.actMax;
    order.forEach(function (grp) {
      var g = el('div', 'cmd-grp');
      g.appendChild(el('h4', '', grp));
      var btns = el('div', 'cmd-btns');
      groups[grp].forEach(function (cd) {
        var b = el('button', 'cmd' + (cd.id === 'shutsujin' ? ' hot' : ''), cd.name);
        b.title = cd.desc + (cd.gold ? '（' + cd.gold + '貫）' : '');
        b.disabled = !canAct;
        b.onclick = function () { UI.command(cd.id, p); };
        btns.appendChild(b);
      });
      g.appendChild(btns);
      wrap.appendChild(g);
    });
    if (!canAct) {
      var n = el('p', 'dim', 'この国は今季の命令を使い切りました。');
      n.style.padding = '0 2px'; wrap.appendChild(n);
    }
    return wrap;
  }

  /* ====================== コマンドのダイアログ ======================= */
  function menOf(p) {
    return E.gensIn(p.id).filter(function (g) { return g.clanId === p.owner; });
  }

  function pickGeneralUI(list, opt, cb) {
    var body = el('div');
    if (opt.note) { var n = el('p', 'hint', opt.note); body.appendChild(n); }
    var pl = el('div', 'pick-list');
    if (!list.length) pl.appendChild(el('p', 'dim', '該当する者がいません。'));
    list.forEach(function (g) {
      var d = el('div', 'pick');
      d.appendChild(el('div', 'nm', g.name));
      d.appendChild(el('div', 'kv', '政' + E.stat(g, 'sei') + ' 戦' + E.stat(g, 'sen') + ' 智' + E.stat(g, 'chi') +
        ' 魅' + E.stat(g, 'cha') + ' 教' + E.stat(g, 'edu') + (g.skills.length ? '　' + g.skills.join('･') : '')));
      if (opt.rate) d.appendChild(el('div', 'rr', opt.rate(g)));
      d.onclick = function () { UI.closeModal(); cb(g); };
      pl.appendChild(d);
    });
    body.appendChild(pl);
    UI.modal({ title: opt.title, body: body, buttons: [{ label: 'やめる' }] });
  }
  UI.pickGeneral = pickGeneralUI;

  function bestFor(p, key, skill) {
    var men = menOf(p).slice();
    men.sort(function (a, b) {
      return (E.stat(b, key) + (skill && E.has(b, skill) ? 22 : 0)) - (E.stat(a, key) + (skill && E.has(a, skill) ? 22 : 0));
    });
    return men;
  }

  function run(res, p) {
    if (!res) return;
    UI.toast(res.msg, res.ok ? 'good' : 'bad');
    if (res.ok) E.log(res.msg, '');
    else E.log(res.msg, 'bad');
    UI.renderTop(); UI.renderMap(); UI.renderSide();
  }
  UI.run = run;

  function amountDialog(opt, cb) {
    var body = el('div');
    if (opt.note) body.appendChild(el('p', 'hint', opt.note));
    var f = el('div', 'field');
    f.appendChild(el('label', '', opt.label));
    var rangeI = el('input'); rangeI.type = 'range';
    rangeI.min = opt.min || 0; rangeI.max = opt.max; rangeI.value = opt.value != null ? opt.value : opt.max;
    var numI = el('input'); numI.type = 'number';
    numI.min = opt.min || 0; numI.max = opt.max; numI.value = rangeI.value;
    var info = el('div', 'hint');
    function upd(v) {
      v = U.clamp(Math.round(v), opt.min || 0, opt.max);
      rangeI.value = v; numI.value = v;
      if (opt.info) info.textContent = opt.info(v);
    }
    rangeI.oninput = function () { upd(+rangeI.value); };
    numI.oninput = function () { upd(+numI.value); };
    f.appendChild(rangeI); f.appendChild(numI);
    body.appendChild(f); body.appendChild(info);
    upd(+rangeI.value);
    UI.modal({
      title: opt.title, body: body,
      buttons: [{ label: 'やめる' }, {
        label: '決定', cls: 'primary', action: function () { cb(+numI.value); }
      }]
    });
  }
  UI.amountDialog = amountDialog;

  UI.command = function (id, p) {
    var st = S();
    var cd = null;
    C.list.forEach(function (x) { if (x.id === id) cd = x; });
    if (p.acted >= p.actMax) { UI.toast('この国はもう動けません。', 'bad'); return; }

    switch (id) {
      case 'kaikon': case 'chisui': case 'shogyo': case 'fushin':
        pickGeneralUI(bestFor(p, 'sei', id === 'fushin' ? '築城' : '内政'),
          { title: cd.name + '　—　担当を選ぶ', note: cd.desc + '（' + cd.gold + '貫）' },
          function (g) { run(C.exec(id, p, g), p); });
        return;
      case 'hodokoshi':
        pickGeneralUI(bestFor(p, 'cha'), { title: '施し　—　担当を選ぶ', note: '民に金を施し、民忠を上げます。（200貫）' },
          function (g) { run(C.hodokoshi(p, g), p); });
        return;
      case 'kunren':
        pickGeneralUI(bestFor(p, 'sen', '騎馬'), { title: '訓練　—　担当を選ぶ', note: '兵を鍛えます。（120貫）' },
          function (g) { run(C.kunren(p, g), p); });
        return;
      case 'gijutsu':
        pickGeneralUI(bestFor(p, 'chi', '鉄砲'), { title: '技術振興　—　担当を選ぶ', note: '鉄砲鍛冶を招き、技術を上げます。（400貫）' },
          function (g) { run(C.gijutsu(p, g), p); });
        return;
      case 'bunka':
        pickGeneralUI(bestFor(p, 'edu', '茶道'), { title: '文化振興　—　担当を選ぶ', note: '連歌・能・茶を興します。（400貫）' },
          function (g) { run(C.bunka(p, g), p); });
        return;
      case 'tansaku':
        pickGeneralUI(bestFor(p, 'chi', '忍法'), { title: '探索　—　担当を選ぶ', note: '人材・宝物・隠し田を探します。（100貫）' },
          function (g) { run(C.tansaku(p, g), p); });
        return;
      case 'chohei': {
        var mx = C.choheiMax(p);
        if (mx <= 0) { UI.toast('これ以上兵は集まりません。', 'bad'); return; }
        amountDialog({
          title: '徴兵', label: '兵数', max: mx, value: Math.min(mx, Math.floor(p.gold / 0.14)),
          note: '民忠が下がります。1人あたり0.14貫。',
          info: function (v) { return '費用 ' + U.num(Math.round(v * 0.14)) + '貫　／　所持金 ' + U.num(p.gold) + '貫'; }
        }, function (n) {
          pickGeneralUI(bestFor(p, 'cha'), { title: '徴兵　—　担当を選ぶ' }, function (g) { run(C.chohei(p, g, n), p); });
        });
        return;
      }
      case 'buygun': {
        var price = C.gunPrice(p), mxg = Math.min(E.maxGun(p) - p.guns, Math.floor(p.gold / price));
        if (mxg <= 0) { UI.toast('買えません。', 'bad'); return; }
        amountDialog({
          title: '鉄砲購入', label: '挺数', max: mxg,
          note: '1挺' + price + '貫' + (p.gunLand ? '（鉄砲鍛冶のある国は安い）' : '') + '。技術が高いほど安く手に入ります。',
          info: function (v) { return '費用 ' + U.num(v * price) + '貫'; }
        }, function (n) {
          pickGeneralUI(bestFor(p, 'sen', '鉄砲'), { title: '鉄砲購入　—　担当を選ぶ' }, function (g) { run(C.buygun(p, g, n), p); });
        });
        return;
      }
      case 'buyhorse': {
        var hp = C.horsePrice(p), mxh = Math.min(E.maxHorse(p) - p.horses, Math.floor(p.gold / hp));
        if (mxh <= 0) { UI.toast('買えません。', 'bad'); return; }
        amountDialog({
          title: '軍馬購入', label: '頭数', max: mxh, note: '1頭' + hp + '貫。',
          info: function (v) { return '費用 ' + U.num(v * hp) + '貫'; }
        }, function (n) {
          pickGeneralUI(bestFor(p, 'sen', '騎馬'), { title: '軍馬購入　—　担当を選ぶ' }, function (g) { run(C.buyhorse(p, g, n), p); });
        });
        return;
      }
      case 'buyrice': {
        var rp = st.ricePrice, mxr = Math.floor(p.gold * 100 / rp);
        if (mxr <= 0) { UI.toast('金がありません。', 'bad'); return; }
        amountDialog({
          title: '兵糧購入', label: '石数', max: mxr, note: '相場：100石あたり' + rp + '貫',
          info: function (v) { return '費用 ' + U.num(Math.round(v * rp / 100)) + '貫'; }
        }, function (n) { run(C.buyrice(p, menOf(p)[0], n), p); });
        return;
      }
      case 'sellrice': {
        amountDialog({
          title: '兵糧売却', label: '石数', max: p.rice, value: Math.round(p.rice / 3),
          note: '相場：100石あたり' + Math.round(st.ricePrice * 0.9) + '貫（売値）',
          info: function (v) { return '収入 ' + U.num(Math.round(v * st.ricePrice * 0.9 / 100)) + '貫'; }
        }, function (n) { run(C.sellrice(p, menOf(p)[0], n), p); });
        return;
      }
      case 'chakai': {
        var hosts = menOf(p).filter(function (g) { return C.bestTeaware(g); });
        if (!hosts.length) { UI.toast('茶器を持つ者がいません。（探索や褒美で手に入ります）', 'bad'); return; }
        if (p.culture < 25) { UI.toast('この国は文化が低く、茶会を開けません。', 'bad'); return; }
        pickGeneralUI(hosts, {
          title: '茶会　—　亭主を選ぶ',
          note: '茶器と教養に応じ、同じ国にいる家臣の忠誠が上がります。（150貫）',
          rate: function (g) { return C.bestTeaware(g).name; }
        }, function (g) { run(C.chakai(p, g), p); });
        return;
      }
      case 'touyou': {
        var frees = E.freeGensIn(p.id);
        if (!frees.length) { UI.toast('この国に在野の武将はいません。', 'bad'); return; }
        var envoys = bestFor(p, 'cha', '弁舌');
        if (!envoys.length) { UI.toast('使者に立つ者がいません。', 'bad'); return; }
        pickGeneralUI(frees, {
          title: '登用　—　誰を招く', note: '（200貫）　※探索で見つけていない者は成功率が読めません',
          rate: function (g) { return g.found ? C.touyouChance(p, envoys[0], g) + '%' : '？'; }
        }, function (t) {
          pickGeneralUI(envoys, {
            title: '登用　—　使者を選ぶ',
            rate: function (g) { return C.touyouChance(p, g, t) + '%'; }
          }, function (g) { run(C.touyou(p, g, t), p); });
        });
        return;
      }
      case 'houbi': {
        var men = menOf(p).filter(function (g) { return g.id !== E.clan(p.owner).lordId; });
        if (!men.length) { UI.toast('対象がいません。', 'bad'); return; }
        pickGeneralUI(men, {
          title: '褒美　—　誰に与える', note: '金または宝物を与えて忠誠を高めます。',
          rate: function (g) { return '忠' + Math.round(g.loyalty); }
        }, function (t) { UI.houbiDialog(p, t); });
        return;
      }
      case 'jouzu': {
        pickGeneralUI(menOf(p), {
          title: '城主任命', note: '城主の政治力は収入・収穫に、戦闘力は守りに影響します。',
          rate: function (g) { return g.id === p.lordGen ? '現城主' : ''; }
        }, function (t) { run(C.jouzu(p, t), p); });
        return;
      }
      case 'tsuihou': {
        var men2 = menOf(p).filter(function (g) { return g.id !== E.clan(p.owner).lordId; });
        pickGeneralUI(men2, { title: '追放', note: '追放した武将は在野となり、所持する宝物も失われます。' },
          function (t) {
            UI.confirm('追放', t.name + 'を追放しますか。', function () { run(C.tsuihou(p, t), p); }, '追放する');
          });
        return;
      }
      case 'idou': {
        var dests = p.adj.filter(function (i) { return E.prov(i).owner === p.owner; });
        if (!dests.length) { UI.toast('隣接する自国がありません。', 'bad'); return; }
        pickGeneralUI(menOf(p), { title: '移動　—　誰を移す' }, function (g) {
          UI.pickProvince(dests, '移動先を選ぶ', function (to) { run(C.idou(p, g, to), p); });
        });
        return;
      }
      case 'yusou': {
        var d2 = p.adj.filter(function (i) { return E.prov(i).owner === p.owner; });
        if (!d2.length) { UI.toast('隣接する自国がありません。', 'bad'); return; }
        UI.pickProvince(d2, '輸送先を選ぶ', function (to) { UI.yusouDialog(p, to); });
        return;
      }
      case 'doumei': case 'enjo': case 'haki': {
        UI.diplomacyDialog(p, id);
        return;
      }
      case 'choutei': {
        var cc = E.clan(p.owner);
        if (cc.courtRank >= 5) { UI.toast('これ以上の官位はありません。', 'bad'); return; }
        amountDialog({
          title: '朝廷工作', label: '献金', max: p.gold, value: Math.min(p.gold, 800 + cc.courtRank * 900),
          note: '官位を得ると民忠・登用・外交に有利になります。山城を領していれば成功しやすくなります。',
          info: function (v) { return '献金 ' + U.num(v) + '貫'; }
        }, function (n) {
          pickGeneralUI(bestFor(p, 'cha', '弁舌'), { title: '朝廷工作　—　使者を選ぶ' },
            function (g) { run(C.choutei(p, g, n), p); });
        });
        return;
      }
      case 'ryugen': case 'sendou': case 'baishuu': {
        var tgts = p.adj.filter(function (i) {
          var q = E.prov(i);
          return q.owner != null && q.owner !== p.owner && !E.allied(p.owner, q.owner);
        });
        if (!tgts.length) { UI.toast('計略をしかける相手がいません。', 'bad'); return; }
        UI.pickProvince(tgts, cd.name + '　—　どの国に', function (to) { UI.plotDialog(p, to, id); });
        return;
      }
      case 'shutsujin': {
        var atk = p.adj.filter(function (i) { return !B.canAttack(p, E.prov(i)); });
        if (!atk.length) { UI.toast('攻め込める国がありません。', 'bad'); return; }
        UI.pickProvince(atk, '出陣　—　攻め込む国', function (to) { UI.shutsujinDialog(p, to); });
        return;
      }
    }
  };

  /* 国の選択（地図から） */
  UI.pickProvince = function (ids, hint, cb) {
    mode = { targets: ids, hint: hint + '（地図から選ぶ／右クリックで取消）', cb: cb };
    UI.renderMap();
    UI.toast(hint, '');
  };
  UI.pickTarget = function (id) {
    if (!mode) return;
    if (mode.targets.indexOf(id) < 0) { UI.toast('選べません。', 'bad'); return; }
    var cb = mode.cb; mode = null;
    UI.renderMap();
    cb(id);
  };
  UI.cancelMode = function () {
    if (!mode) return false;
    mode = null; UI.renderMap(); return true;
  };

  /* --------------------------- 褒美 ---------------------------------- */
  UI.houbiDialog = function (p, t) {
    var st = S();
    var giver = E.gen(p.lordGen) || menOf(p)[0];
    var body = el('div');
    body.appendChild(el('p', 'hint', t.name + '　忠誠 ' + Math.round(t.loyalty)));
    var tabs = el('div', 'field');
    var gold = el('button', 'btn sm primary', '金を与える');
    var item = el('button', 'btn sm', '宝物を与える');
    tabs.appendChild(gold); tabs.appendChild(item);
    body.appendChild(tabs);
    var area = el('div');
    body.appendChild(area);

    function goldView() {
      area.innerHTML = '';
      var f = el('div', 'field');
      f.appendChild(el('label', '', '金'));
      var r = el('input'); r.type = 'range'; r.min = 0; r.max = p.gold; r.value = Math.min(p.gold, 600);
      var n = el('input'); n.type = 'number'; n.min = 0; n.max = p.gold; n.value = r.value;
      var inf = el('div', 'hint');
      function upd(v) {
        v = U.clamp(Math.round(v), 0, p.gold); r.value = v; n.value = v;
        inf.textContent = '忠誠 +' + U.clamp(Math.round(v / 60 + (giver.cha - 50) / 20), 0, 26);
      }
      r.oninput = function () { upd(+r.value); }; n.oninput = function () { upd(+n.value); };
      f.appendChild(r); f.appendChild(n);
      area.appendChild(f); area.appendChild(inf); upd(+r.value);
      area._get = function () { return +n.value; };
      area._mode = 'gold';
    }
    function itemView() {
      area.innerHTML = '';
      area._mode = 'item';
      var owned = [];
      menOf(p).forEach(function (g) {
        g.items.forEach(function (i) { owned.push({ g: g, t: st.treasures[i] }); });
      });
      if (!owned.length) { area.appendChild(el('p', 'dim', 'この国に宝物はありません。')); area._get = function () { return null; }; return; }
      var pl = el('div', 'pick-list');
      var chosen = null;
      owned.forEach(function (o) {
        var d = el('div', 'pick');
        d.appendChild(el('div', 'nm', o.t.name));
        d.appendChild(el('div', 'kv', o.t.kind + '　所持：' + o.g.name));
        d.onclick = function () {
          $$('.pick', pl).forEach(function (x) { x.classList.remove('on'); });
          d.classList.add('on'); chosen = o;
        };
        pl.appendChild(d);
      });
      area.appendChild(pl);
      area._get = function () { return chosen; };
    }
    gold.onclick = function () { gold.classList.add('primary'); item.classList.remove('primary'); goldView(); };
    item.onclick = function () { item.classList.add('primary'); gold.classList.remove('primary'); itemView(); };
    goldView();

    UI.modal({
      title: '褒美', body: body, buttons: [
        { label: 'やめる' },
        {
          label: '与える', cls: 'primary', action: function () {
            if (area._mode === 'gold') run(C.houbi(p, giver, t, area._get()), p);
            else {
              var o = area._get();
              if (!o) { UI.toast('宝物を選んでください。', 'bad'); return false; }
              if (o.g.id === t.id) { UI.toast('本人が持っています。', 'bad'); return false; }
              run(C.giveItem(p, o.g, t, o.t.id), p);
            }
          }
        }
      ]
    });
  };

  /* --------------------------- 輸送 ---------------------------------- */
  UI.yusouDialog = function (p, toId) {
    var q = E.prov(toId);
    var body = el('div');
    body.appendChild(el('p', 'hint', p.name + ' → ' + q.name + '　' +
      (p.sea.indexOf(toId) >= 0 ? '（海路：米が6%失われます）' : '（陸路：米が2%失われます）')));
    function mk(label, max, def) {
      var f = el('div', 'field');
      f.appendChild(el('label', '', label));
      var r = el('input'); r.type = 'range'; r.min = 0; r.max = max; r.value = def;
      var n = el('input'); n.type = 'number'; n.min = 0; n.max = max; n.value = def;
      r.oninput = function () { n.value = r.value; };
      n.oninput = function () { r.value = n.value; };
      f.appendChild(r); f.appendChild(n);
      body.appendChild(f);
      return function () { return +n.value; };
    }
    var gg = mk('金', p.gold, 0);
    var rr = mk('米', p.rice, 0);
    var hh = mk('兵', Math.min(p.hei, Math.max(0, E.maxHei(q) - q.hei)), 0);
    UI.modal({
      title: '輸送', body: body, buttons: [
        { label: 'やめる' },
        { label: '送る', cls: 'primary', action: function () { run(C.yusou(p, toId, gg(), rr(), hh()), p); } }
      ]
    });
  };

  /* --------------------------- 外交 ---------------------------------- */
  UI.diplomacyDialog = function (p, kind) {
    var st = S(), me = p.owner;
    var others = E.aliveClans().filter(function (c) { return c.id !== me && E.provsOf(c.id).length; });
    if (kind === 'haki') others = others.filter(function (c) { return E.allied(me, c.id); });
    if (!others.length) { UI.toast('相手がいません。', 'bad'); return; }
    others.sort(function (a, b) { return E.clanPower(b.id) - E.clanPower(a.id); });
    var body = el('div');
    var pl = el('div', 'pick-list');
    var envoy = bestFor(p, 'sei', '弁舌')[0];
    others.forEach(function (c) {
      var d = el('div', 'pick');
      var sw = el('div', 'sw'); sw.style.cssText = 'width:11px;height:11px;border-radius:2px;background:' + c.color;
      d.appendChild(sw);
      d.appendChild(el('div', 'nm', c.name + '家'));
      d.appendChild(el('div', 'kv', (E.gen(c.lordId) ? E.gen(c.lordId).name : '') + '　' + E.provsOf(c.id).length + 'か国' +
        (E.allied(me, c.id) ? '　同盟中' : '')));
      if (kind === 'doumei' && envoy) d.appendChild(el('div', 'rr', C.doumeiChance(me, c.id, envoy, 0) + '%'));
      d.onclick = function () {
        UI.closeModal();
        if (kind === 'haki') {
          UI.confirm('同盟破棄', c.name + '家との同盟を破棄しますか。信用が下がります。',
            function () { run(C.haki(p, c.id), p); }, '破棄する');
        } else if (kind === 'enjo') {
          var b2 = el('div');
          b2.appendChild(el('p', 'hint', c.name + '家に金・米を贈ります。信用が上がり、同盟を結びやすくなります。'));
          function mk(label, max) {
            var f = el('div', 'field');
            f.appendChild(el('label', '', label));
            var r = el('input'); r.type = 'range'; r.min = 0; r.max = max; r.value = 0;
            var n = el('input'); n.type = 'number'; n.min = 0; n.max = max; n.value = 0;
            r.oninput = function () { n.value = r.value; }; n.oninput = function () { r.value = n.value; };
            f.appendChild(r); f.appendChild(n); b2.appendChild(f);
            return function () { return +n.value; };
          }
          var gg = mk('金', p.gold), rr2 = mk('米', p.rice);
          UI.modal({
            title: '援助', body: b2, buttons: [{ label: 'やめる' },
            { label: '贈る', cls: 'primary', action: function () { run(C.enjo(p, c.id, gg(), rr2()), p); } }]
          });
        } else {
          amountDialog({
            title: '同盟　—　' + c.name + '家', label: '進物', max: p.gold, value: Math.min(p.gold, 500),
            note: '進物が多いほど成立しやすくなります。',
            info: function (v) { return '成功率およそ ' + C.doumeiChance(me, c.id, envoy, v) + '%'; }
          }, function (n) { run(C.doumei(p, envoy, c.id, n), p); });
        }
      };
      pl.appendChild(d);
    });
    body.appendChild(pl);
    UI.modal({ title: { doumei: '同盟', enjo: '援助', haki: '同盟破棄' }[kind], body: body, buttons: [{ label: 'やめる' }] });
  };

  /* --------------------------- 計略 ---------------------------------- */
  UI.plotDialog = function (p, toId, kind) {
    var q = E.prov(toId);
    var casters = bestFor(p, 'chi', '忍法');
    if (!casters.length) { UI.toast('計略を行う者がいません。', 'bad'); return; }
    if (kind === 'sendou') {
      pickGeneralUI(casters, { title: '扇動　—　誰が行う', note: q.name + '（民忠' + q.minchu + '）に一揆を起こします。（300貫）' },
        function (g) { run(C.sendou(p, g, q), p); });
      return;
    }
    var targets = E.gensIn(q.id).filter(function (g) {
      var c = E.clan(q.owner);
      return g.clanId === q.owner && !(c && c.lordId === g.id);
    });
    if (!targets.length) { UI.toast('相手となる武将がいません。', 'bad'); return; }
    targets.sort(function (a, b) { return a.loyalty - b.loyalty; });
    pickGeneralUI(targets, {
      title: (kind === 'ryugen' ? '流言' : '調略') + '　—　誰を狙う',
      note: kind === 'ryugen' ? '忠誠を下げます。（250貫）' : '寝返らせます。城主が単独で守っていれば、国ごと手に入ることも。',
      rate: function (g) { return '忠' + Math.round(g.loyalty) + '／野' + g.amb; }
    }, function (t) {
      pickGeneralUI(casters, { title: '誰が行う' }, function (g) {
        if (kind === 'ryugen') { run(C.ryugen(p, g, q, t), p); return; }
        amountDialog({
          title: '調略　—　' + t.name, label: '調略金', max: p.gold, value: Math.min(p.gold, 1500),
          note: '金が多いほど成功しやすくなります。',
          info: function (v) {
            var ch = U.clamp(Math.round(8 + v / 55 + (t.amb - 50) * 0.4 + (E.stat(g, 'chi') - 50) * 0.7 +
              (E.has(g, '忍法') ? 18 : 0) - E.stat(t, 'chi') * 0.35 - t.loyalty * 0.3), 3, 92);
            return '成功率およそ ' + ch + '%';
          }
        }, function (n) { run(C.baishuu(p, g, t, n), p); });
      });
    });
  };

  /* --------------------------- 出陣 ---------------------------------- */
  UI.shutsujinDialog = function (p, toId) {
    var q = E.prov(toId);
    var men = menOf(p);
    if (!men.length) { UI.toast('武将がいません。', 'bad'); return; }
    men = men.slice().sort(function (a, b) { return E.stat(b, 'sen') - E.stat(a, 'sen'); });
    var chosen = {}, troops = {}, types = {};
    men.slice(0, Math.min(5, men.length)).forEach(function (g) { chosen[g.id] = true; });

    var body = el('div');
    var head = el('p', 'hint');
    body.appendChild(head);
    var pl = el('div', 'pick-list');
    body.appendChild(pl);

    var ctl = el('div');
    body.appendChild(ctl);
    var totalF = el('div', 'field');
    totalF.appendChild(el('label', '', '出陣兵数'));
    var tr = el('input'); tr.type = 'range'; tr.min = 0; tr.max = Math.max(0, p.hei - 100);
    tr.value = Math.round(Math.max(0, p.hei - 100) * 0.8);
    var tn = el('input'); tn.type = 'number'; tn.min = 0; tn.max = tr.max; tn.value = tr.value;
    totalF.appendChild(tr); totalF.appendChild(tn);
    ctl.appendChild(totalF);
    var riceF = el('div', 'field');
    riceF.appendChild(el('label', '', '兵糧'));
    var rr = el('input'); rr.type = 'range'; rr.min = 0; rr.max = p.rice;
    var rn = el('input'); rn.type = 'number'; rn.min = 0; rn.max = p.rice;
    riceF.appendChild(rr); riceF.appendChild(rn);
    ctl.appendChild(riceF);
    var summary = el('div', 'hint');
    ctl.appendChild(summary);

    function counts() {
      var n = 0; men.forEach(function (g) { if (chosen[g.id]) n++; });
      return n;
    }
    function autoRice() {
      var t = +tn.value;
      var v = Math.min(p.rice, Math.round(t / 5.5) + 400);
      rr.value = v; rn.value = v;
    }
    function distribute() {
      var t = +tn.value, list = men.filter(function (g) { return chosen[g.id]; });
      var each = list.length ? Math.floor(t / list.length) : 0;
      var gunsLeft = p.guns, horseLeft = p.horses;
      list.forEach(function (g, i) {
        troops[g.id] = each;
        if (types[g.id] === undefined) {
          if (E.has(g, '鉄砲')) types[g.id] = '鉄砲';
          else if (E.has(g, '騎馬')) types[g.id] = '騎馬';
          else types[g.id] = i % 3 === 1 ? '鉄砲' : (i % 3 === 2 ? '騎馬' : '足軽');
        }
      });
      /* 装備の充足を確認 */
      var needGun = 0, needHorse = 0;
      list.forEach(function (g) {
        if (types[g.id] === '鉄砲') needGun += Math.round(troops[g.id] / 3);
        if (types[g.id] === '騎馬') needHorse += Math.round(troops[g.id] / 4);
      });
      list.forEach(function (g) {
        if (types[g.id] === '鉄砲' && needGun > p.guns) types[g.id] = '足軽';
        if (types[g.id] === '騎馬' && needHorse > p.horses) types[g.id] = '足軽';
      });
      needGun = 0; needHorse = 0;
      list.forEach(function (g) {
        if (types[g.id] === '鉄砲') needGun += Math.round(troops[g.id] / 3);
        if (types[g.id] === '騎馬') needHorse += Math.round(troops[g.id] / 4);
      });
      summary.innerHTML = '大将 <b>' + (list[0] ? list[0].name : '—') + '</b>　部隊 ' + list.length + '　' +
        '一隊 ' + U.num(each) + '人<br>' +
        '必要な鉄砲 ' + U.num(needGun) + '／' + U.num(p.guns) + '　必要な馬 ' + U.num(needHorse) + '／' + U.num(p.horses) +
        '<br>兵糧は1ターンごとに減ります。少ないと士気が崩れます。';
      renderList();
    }
    function renderList() {
      pl.innerHTML = '';
      men.forEach(function (g) {
        var d = el('div', 'pick' + (chosen[g.id] ? ' on' : ''));
        d.appendChild(el('div', 'nm', g.name));
        d.appendChild(el('div', 'kv', '戦' + E.stat(g, 'sen') + ' 智' + E.stat(g, 'chi') +
          (g.skills.length ? '　' + g.skills.join('･') : '')));
        if (chosen[g.id]) {
          var s = el('select');
          ['足軽', '騎馬', '鉄砲'].forEach(function (t) {
            var o = el('option', '', t); o.value = t;
            if (types[g.id] === t) o.selected = true;
            s.appendChild(o);
          });
          s.onclick = function (e) { e.stopPropagation(); };
          s.onchange = function () { types[g.id] = s.value; distribute(); };
          var rr2 = el('div', 'rr', U.num(troops[g.id] || 0) + '人');
          d.appendChild(s); d.appendChild(rr2);
        }
        d.onclick = function () {
          if (chosen[g.id]) { if (counts() <= 1) { UI.toast('最低ひとりは要ります。', 'bad'); return; } delete chosen[g.id]; }
          else { if (counts() >= 8) { UI.toast('八隊までです。', 'bad'); return; } chosen[g.id] = true; }
          distribute();
        };
        pl.appendChild(d);
      });
    }
    tr.oninput = function () { tn.value = tr.value; autoRice(); distribute(); };
    tn.oninput = function () { tr.value = tn.value; autoRice(); distribute(); };
    rr.oninput = function () { rn.value = rr.value; };
    rn.oninput = function () { rr.value = rn.value; };

    var defMen = E.gensIn(q.id).filter(function (g) { return g.clanId === q.owner; });
    head.innerHTML = '<b>' + p.name + '</b> より <b>' + q.name + '</b>（' +
      (q.owner != null ? E.clan(q.owner).name + '家' : '無主') + '）へ<br>' +
      '敵：兵 <b>' + U.num(q.hei) + '</b>　訓練 ' + q.training + '　城 ' + q.castleLv +
      '　鉄砲 ' + U.num(q.guns) + '　武将 ' + defMen.length + '人' +
      (defMen.length ? '（' + defMen.slice(0, 5).map(function (g) { return g.name; }).join('、') + '）' : '') +
      (p.sea.indexOf(toId) >= 0 ? '<br><span style="color:#f0a49a">海を越える攻撃です</span>' : '');
    autoRice(); distribute();

    UI.modal({
      title: '出陣', body: body, buttons: [
        { label: 'やめる' },
        {
          label: '出陣！', cls: 'primary', action: function () {
            var list = men.filter(function (g) { return chosen[g.id]; });
            var total = +tn.value, rice = +rn.value;
            if (total < 100) { UI.toast('兵が少なすぎます。', 'bad'); return false; }
            if (!list.length) { UI.toast('武将を選んでください。', 'bad'); return false; }
            var force = {
              gens: list.map(function (g) { return { gen: g, troops: troops[g.id], type: types[g.id] }; }),
              rice: rice
            };
            p.hei -= total; p.rice -= rice; p.acted = p.actMax;
            var b = B.create(p, q, force, {});
            UI.closeModal();
            NB.battleUI.open(b, 0);
          }
        }
      ]
    });
  };

  /* ============================ 一覧画面 ============================= */
  UI.ranking = function () {
    var st = S();
    var list = E.aliveClans().filter(function (c) { return E.provsOf(c.id).length; });
    list.sort(function (a, b) { return E.provsOf(b.id).length - E.provsOf(a.id).length || E.clanPower(b.id) - E.clanPower(a.id); });
    var h = '<table class="tbl"><tr><th>順</th><th>家</th><th>当主</th><th class="n">国</th><th class="n">兵</th><th class="n">石高</th><th class="n">武将</th><th>外交</th></tr>';
    list.forEach(function (c, i) {
      var ps = E.provsOf(c.id), hei = 0, koku = 0;
      ps.forEach(function (p) { hei += p.hei; koku += p.koku; });
      var lord = E.gen(c.lordId);
      h += '<tr class="' + (c.id === st.playerClan ? 'me' : '') + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span style="display:inline-block;width:9px;height:9px;background:' + c.color + ';border-radius:2px;margin-right:5px"></span>' + c.name + '</td>' +
        '<td>' + (lord ? lord.name : '—') + '</td>' +
        '<td class="n">' + ps.length + '</td><td class="n">' + U.num(hei) + '</td><td class="n">' + U.num(koku) + '</td>' +
        '<td class="n">' + E.gensOf(c.id).length + '</td>' +
        '<td>' + (E.allied(st.playerClan, c.id) ? '<span style="color:#8fd6a4">同盟</span>' : (c.id === st.playerClan ? '—' : '')) + '</td></tr>';
    });
    h += '</table>';
    UI.modal({ title: '全国情勢　' + st.year + '年' + NB.DATA.seasons[st.season], body: h });
  };

  UI.retainers = function () {
    var st = S();
    var men = E.gensOf(st.playerClan).slice();
    var sortKey = 'sen';
    var body = el('div');
    var bar = el('div', 'field');
    bar.appendChild(el('label', '', '並び替え'));
    var sSel = el('select');
    [['sen', '戦闘'], ['sei', '政治'], ['chi', '智謀'], ['cha', '魅力'], ['edu', '教養'], ['loyalty', '忠誠']].forEach(function (o) {
      var op = el('option', '', o[1]); op.value = o[0]; sSel.appendChild(op);
    });
    bar.appendChild(sSel);
    body.appendChild(bar);
    var tblWrap = el('div');
    body.appendChild(tblWrap);
    function draw() {
      men.sort(function (a, b) {
        var av = sortKey === 'loyalty' ? a.loyalty : E.stat(a, sortKey);
        var bv = sortKey === 'loyalty' ? b.loyalty : E.stat(b, sortKey);
        return bv - av;
      });
      var h = '<table class="tbl"><tr><th>名</th><th>在城</th><th class="n">政</th><th class="n">戦</th><th class="n">智</th><th class="n">魅</th><th class="n">教</th><th class="n">忠</th><th>特技・宝物</th></tr>';
      men.forEach(function (g) {
        var p = E.prov(g.provId);
        var its = g.items.map(function (i) { return st.treasures[i].name; });
        h += '<tr><td>' + g.name + (E.clan(g.clanId).lordId === g.id ? '<span class="dim">（当主）</span>' : '') + '</td>' +
          '<td>' + (p ? p.name : '—') + (p && p.lordGen === g.id ? '<span class="dim">城主</span>' : '') + '</td>' +
          '<td class="n">' + E.stat(g, 'sei') + '</td><td class="n">' + E.stat(g, 'sen') + '</td>' +
          '<td class="n">' + E.stat(g, 'chi') + '</td><td class="n">' + E.stat(g, 'cha') + '</td>' +
          '<td class="n">' + E.stat(g, 'edu') + '</td><td class="n">' + Math.round(g.loyalty) + '</td>' +
          '<td class="dim">' + g.skills.join('･') + (its.length ? '　<span style="color:#e3bd6a">' + its.join('、') + '</span>' : '') + '</td></tr>';
      });
      h += '</table>';
      tblWrap.innerHTML = h;
    }
    sSel.onchange = function () { sortKey = sSel.value; draw(); };
    draw();
    UI.modal({ title: '家臣一覧', body: body });
  };

  UI.help = function () {
    var h = '<div class="helpbox">' +
      '<h4>目的</h4><p>五十九か国すべてを従え、天下を統一すること。自家が滅べば負けです。</p>' +
      '<h4>季節と命令</h4><p>一年は春夏秋冬の四季。各国は毎季かならず一回（本城は二回、政治力85以上の城主がいればさらに一回）命令を出せます。' +
      '国をクリックして命令を選び、〈季節を終える〉で次へ進みます。</p>' +
      '<h4>金と米</h4><p>金と米は<b>国ごと</b>に管理します。金は商業から毎季、米は秋の収穫で入ります。' +
      '兵は毎季米を食べ、足りないと逃散します。〈輸送〉で隣国へ回してください。</p>' +
      '<h4>兵種</h4><p>足軽・騎馬・鉄砲の三すくみ。<b>鉄砲は騎馬に強く</b>、騎馬は鉄砲以外に強い。' +
      '鉄砲は離れて撃てて反撃を受けませんが、接近戦には弱い。鉄砲隊は鉄砲、騎馬隊は軍馬が必要です。</p>' +
      '<h4>文化と茶の湯</h4><p>〈文化振興〉は民忠と商いを潤し、〈技術振興〉は鉄砲を安く強くします。' +
      '茶器を持つ武将は〈茶会〉を催し、同じ国の家臣の忠誠を大きく上げられます。茶器は〈探索〉で見つかります。</p>' +
      '<h4>人は城</h4><p>忠誠が下がった武将は出奔したり、敵に調略されたりします。褒美・宝物・茶会・城主任命で心を繋ぎとめましょう。' +
      '相性（見えません）が悪い者ほど忠誠は下がりやすくなります。</p>' +
      '<h4>合戦</h4><p>隣国へ〈出陣〉すると合戦になります。部隊を動かし、<b>本丸を占拠</b>するか敵を全滅させれば勝ち。' +
      '三十ターン経つか兵糧が尽きれば寄せ手の負けです。〈委任〉で自動、〈退却〉で撤兵できます。</p>' +
      '<h4>操作</h4><p>地図はドラッグで移動、＋－で拡大縮小。右クリックで目標選択を取り消せます。</p>' +
      '</div>';
    UI.modal({ title: '遊び方', body: h });
  };

  /* ============================ 捕虜の処遇 =========================== */
  UI.captives = function (list, after) {
    if (!list || !list.length) { if (after) after(); return; }
    var st = S();
    var g = E.gen(list[0]);
    if (!g || g.status !== 'captive' || g.captiveOf !== st.playerClan) {
      UI.captives(list.slice(1), after); return;
    }
    var body = el('div');
    body.innerHTML = '<p class="hint">' + g.name + ' を捕らえた。いかがなさいますか。</p>' +
      '<table class="tbl">' +
      '<tr><th>政治</th><td class="n">' + E.stat(g, 'sei') + '</td><th>戦闘</th><td class="n">' + E.stat(g, 'sen') + '</td></tr>' +
      '<tr><th>智謀</th><td class="n">' + E.stat(g, 'chi') + '</td><th>義理</th><td class="n">' + g.giri + '</td></tr>' +
      '<tr><th>特技</th><td colspan="3">' + (g.skills.join('・') || 'なし') + '</td></tr></table>';
    UI.modal({
      title: '捕虜', body: body, buttons: [
        {
          label: '登用する', cls: 'primary', action: function () {
            var r = B.captiveAction(g.id, 'hire', st.playerClan);
            UI.toast(r.msg, r.ok ? 'good' : 'bad'); E.log(r.msg, r.ok ? 'good' : '');
            if (!r.ok) { B.captiveAction(g.id, 'free', st.playerClan); }
            UI.captives(list.slice(1), after);
          }
        },
        {
          label: '解放する', action: function () {
            var r = B.captiveAction(g.id, 'free', st.playerClan);
            UI.toast(r.msg, ''); E.log(r.msg, '');
            UI.captives(list.slice(1), after);
          }
        },
        {
          label: '斬る', cls: 'danger', action: function () {
            var r = B.captiveAction(g.id, 'kill', st.playerClan);
            UI.toast(r.msg, 'bad'); E.log(r.msg, 'bad');
            UI.captives(list.slice(1), after);
          }
        }
      ]
    });
  };

  UI.playerCaptives = function () {
    var st = S();
    return st.generals.filter(function (g) { return g.status === 'captive' && g.captiveOf === st.playerClan; }).map(function (g) { return g.id; });
  };

  /* ============================ 全体描画 ============================= */
  UI.renderAll = function () {
    UI.renderTop(); UI.renderMap(); UI.renderSide(); UI.renderLog();
  };

  /* ============================ 地図の操作 =========================== */
  UI.bindMapControls = function () {
    var wrap = $('#mapwrap');
    var dragging = false, lx = 0, ly = 0, moved = 0;
    wrap.addEventListener('mousedown', function (e) {
      if (e.button === 2) return;
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY;
      wrap.classList.add('drag');
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      panX += e.clientX - lx; panY += e.clientY - ly;
      moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
      applyTransform();
    });
    window.addEventListener('mouseup', function () { dragging = false; wrap.classList.remove('drag'); });
    wrap.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (UI.cancelMode()) UI.toast('取り消しました。', '');
    });
    wrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      UI.zoomBy(e.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });
    window.addEventListener('resize', function () { UI.fit(); });
    window.addEventListener('keydown', function (e) {
      if ($('#modal').classList.contains('show')) {
        if (e.key === 'Escape') UI.closeModal();
        return;
      }
      var d = 60;
      if (e.key === 'ArrowLeft') { panX += d; applyTransform(); }
      else if (e.key === 'ArrowRight') { panX -= d; applyTransform(); }
      else if (e.key === 'ArrowUp') { panY += d; applyTransform(); }
      else if (e.key === 'ArrowDown') { panY -= d; applyTransform(); }
      else if (e.key === 'Escape') { UI.cancelMode(); }
      else if (e.key === '+' || e.key === '=') UI.zoomBy(1.15);
      else if (e.key === '-') UI.zoomBy(0.87);
    });
  };

})(typeof window !== 'undefined' ? window : globalThis);
