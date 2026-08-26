/* =========================================================================
 *  戦国風雲録  —  起動・進行管理・記録
 * ========================================================================= */
(function (global) {
  'use strict';
  var NB = global.NB, E = NB.engine, C = NB.cmd, B = NB.battle, UI = NB.ui, AI = NB.ai, U = NB.util;
  var $ = UI.$, $$ = UI.$$, el = UI.el;
  var SAVE_KEY = 'sengoku_fuunroku_save_v1';

  var setup = { scenario: NB.DATA.scenarios[0].id, clan: null };

  /* ============================ タイトル ============================= */
  function bindTitle() {
    $$('#title [data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === 'new') { openSetup(); }
        else if (a === 'load') { loadGame(); }
        else if (a === 'help') { UI.help(); }
      };
    });
    $('#setup [data-act="back-title"]').onclick = function () { UI.show('title'); };
    $('#startBtn').onclick = startGame;
    $('#modalX').onclick = UI.closeModal;
    $('#modal').onclick = function (e) { if (e.target === $('#modal')) UI.closeModal(); };
  }

  /* ============================ 設定画面 ============================= */
  function openSetup() {
    UI.show('setup');
    var list = $('#scenarioList');
    list.innerHTML = '';
    NB.DATA.scenarios.forEach(function (s) {
      var d = el('div', 'scn' + (s.id === setup.scenario ? ' on' : ''));
      d.innerHTML = '<h3>' + s.name + '</h3><div class="yr">' + s.year + '年 ' + NB.DATA.seasons[s.season || 0] + '</div><p>' + s.caption + '</p>';
      d.onclick = function () {
        setup.scenario = s.id; setup.clan = null;
        $$('.scn', list).forEach(function (x) { x.classList.remove('on'); });
        d.classList.add('on');
        renderClanList();
        $('#clanDetail').innerHTML = '<p class="dim">大名家を選んでください。</p>';
        $('#startBtn').disabled = true;
      };
      list.appendChild(d);
    });
    renderClanList();
  }

  function scenarioData() {
    var sc = null;
    NB.DATA.scenarios.forEach(function (s) { if (s.id === setup.scenario) sc = s; });
    return sc;
  }

  function renderClanList() {
    var sc = scenarioData(), box = $('#clanList');
    box.innerHTML = '';
    var clans = sc.clans.slice();
    clans.sort(function (a, b) { return b.provs.length - a.provs.length; });
    clans.forEach(function (c) {
      var d = el('div', 'clan-chip');
      var sw = el('div', 'sw'); sw.style.background = c.color;
      d.appendChild(sw);
      d.appendChild(el('b', '', c.name));
      d.appendChild(el('i', '', c.provs.length + '国'));
      d.onclick = function () {
        setup.clan = c.name;
        $$('.clan-chip', box).forEach(function (x) { x.classList.remove('on'); });
        d.classList.add('on');
        showClanDetail(c);
        $('#startBtn').disabled = false;
      };
      box.appendChild(d);
    });
  }

  function showClanDetail(c) {
    var sc = scenarioData();
    var lordRow = null;
    NB.DATA.generalTable.trim().split('\n').forEach(function (l) {
      var f = l.split('|');
      if (f[0] === c.lord) lordRow = f;
    });
    var maxP = 0;
    sc.clans.forEach(function (x) { maxP = Math.max(maxP, x.provs.length); });
    var members = c.men.length + 1;
    var diffScore = c.provs.length * 2 + members * 0.3;
    var stars = diffScore > 14 ? 1 : diffScore > 8 ? 2 : diffScore > 5 ? 3 : diffScore > 3 ? 4 : 5;
    var box = $('#clanDetail');
    box.innerHTML =
      '<h3>' + c.name + '家</h3>' +
      '<p class="dim">当主　' + c.lord + (lordRow ? '（' + (sc.year - (+lordRow[8])) + '歳）' : '') + '</p>' +
      (lordRow ? '<table class="tbl">' +
        '<tr><th>政治</th><td class="n">' + lordRow[1] + '</td><th>戦闘</th><td class="n">' + lordRow[2] + '</td></tr>' +
        '<tr><th>智謀</th><td class="n">' + lordRow[3] + '</td><th>魅力</th><td class="n">' + lordRow[4] + '</td></tr>' +
        '<tr><th>野望</th><td class="n">' + lordRow[5] + '</td><th>教養</th><td class="n">' + lordRow[7] + '</td></tr>' +
        '</table>' : '') +
      '<p style="margin-top:9px">領国　' + c.provs.join('・') + '</p>' +
      '<p class="dim">家臣 ' + c.men.length + '人</p>' +
      '<p class="diff">難易度　<span style="color:var(--gold2);letter-spacing:2px">' + '★'.repeat(stars) + '☆'.repeat(5 - stars) + '</span></p>';
  }

  function startGame() {
    if (!setup.clan) return;
    E.newGame(setup.scenario, setup.clan, Math.floor(Math.random() * 1e9));
    UI.show('game');
    UI.buildMap();
    var st = E.getState();
    var cap = E.clan(st.playerClan).capital;
    UI.renderAll();
    setTimeout(function () { UI.centerOn(cap); UI.clickProv(cap); }, 30);
    UI.toast('天下は乱れ、家々が競い合う。', '');
  }

  /* ============================ 進行 ================================= */
  function endTurn() {
    var st = E.getState();
    var left = E.provsOf(st.playerClan).filter(function (p) { return p.acted < p.actMax; });
    if (left.length) {
      UI.confirm('季節を終える',
        'まだ命令を出していない国が ' + left.length + ' か国あります（' +
        left.slice(0, 6).map(function (p) { return p.name; }).join('、') + (left.length > 6 ? ' ほか' : '') + '）。<br>このまま季節を終えますか。',
        function () { runAI(); }, '終える');
      return;
    }
    runAI();
  }

  function runAI() {
    $('#endTurnBtn').disabled = true;
    AI.begin();
    processAI();
  }

  function processAI() {
    var battle = AI.run();
    if (battle) {
      UI.toast(E.clan(battle.atkClan).name + '家が' + E.prov(battle.prov).name + 'に攻め寄せた！', 'bad');
      setTimeout(function () {
        NB.battleUI.open(battle, 1, function () {
          if (E.getState().ended) { finishGame(); return; }
          processAI();
        });
      }, 500);
      return;
    }
    E.endSeason();
    UI.renderAll();
    $('#endTurnBtn').disabled = false;
    var st = E.getState();
    if (st.ended) { finishGame(); return; }
    if (st.season === 0) UI.toast(st.year + '年。新しい年が明けた。', '');
    autosave();
  }

  function finishGame() {
    var st = E.getState();
    var win = st.over === 'win';
    var c = E.clan(st.playerClan);
    UI.modal({
      title: win ? '天下統一' : '落城',
      body: win
        ? '<p class="hint" style="font-size:15px;line-height:2.2">' + st.year + '年、' + c.name + '家は日ノ本六十余州をことごとく従えた。<br>乱世は終わり、そなたの名は千年のちまで語り継がれる。</p>'
        : '<p class="hint" style="font-size:15px;line-height:2.2">' + st.year + '年、' + c.name + '家は滅びた。<br>——されど、それもまた戦国の習いである。</p>',
      buttons: [{
        label: 'タイトルへ', cls: 'primary', action: function () {
          try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
          UI.show('title');
        }
      }]
    });
  }

  /* ============================ 記録 ================================= */
  function autosave() {
    try { localStorage.setItem(SAVE_KEY, E.serialize()); } catch (e) {}
  }
  function saveDialog() {
    var okSave = true;
    try { localStorage.setItem(SAVE_KEY, E.serialize()); } catch (e) { okSave = false; }
    var st = E.getState();
    UI.modal({
      title: '記録',
      body: okSave
        ? '<p>' + st.year + '年' + NB.DATA.seasons[st.season] + '、' + E.clan(st.playerClan).name + '家の様子を書き留めた。</p>' +
          '<p class="hint">季節が変わるたびに自動でも記録されます。タイトル画面の〈続きから〉で再開できます。</p>'
        : '<p>記録できませんでした。（ブラウザの設定をご確認ください）</p>',
      buttons: [{ label: '閉じる', cls: 'primary' }]
    });
  }
  function loadGame() {
    var raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (!raw) { UI.toast('記録がありません。', 'bad'); return; }
    try {
      E.deserialize(raw);
    } catch (e) {
      UI.toast('記録を読み込めませんでした。', 'bad'); return;
    }
    UI.show('game');
    UI.buildMap();
    UI.renderAll();
    var st = E.getState();
    var cap = E.clan(st.playerClan).capital;
    setTimeout(function () { if (cap >= 0) { UI.centerOn(cap); UI.clickProv(cap); } }, 30);
    UI.toast('記録から再開しました。', 'good');
  }

  /* ============================ 起動 ================================= */
  function bindGame() {
    $('#endTurnBtn').onclick = endTurn;
    $$('#topbar [data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === 'ranking') UI.ranking();
        else if (a === 'retainers') UI.retainers();
        else if (a === 'save') saveDialog();
        else if (a === 'help') UI.help();
      };
    });
    $$('#mapctl [data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === 'zoomin') UI.zoomBy(1.2);
        else if (a === 'zoomout') UI.zoomBy(0.83);
        else UI.fit();
      };
    });
    $('#sideToggle').onclick = function () { $('#side').classList.toggle('open'); };
    UI.bindMapControls();
    NB.battleUI.bind();
  }

  function boot() {
    bindTitle();
    bindGame();
    UI.show('title');
    var has = false;
    try { has = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (!has) $('#title [data-act="load"]').disabled = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof window !== 'undefined' ? window : globalThis);
