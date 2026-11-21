/* ============================================================
 * PGL Major Singapore 2026 对阵预测作业 — UI 逻辑 (v2)
 * 分页式: 总览 / 第一阶段 / 第二阶段 / 第三阶段 / 季后赛
 * 功能: 拖拽初始对阵 · 手动点选赛果 · 部分模拟到完赛 · 实时晋级概率
 * 依赖: data.js (MAJOR_DATA), sim.js (SIM)
 * ============================================================ */
(function () {
  'use strict';

  var D = window.MAJOR_DATA;
  var SIM = window.SIM;
  var S = D.CONFIG.S;
  var TEAM_BY_ID = D.TEAM_BY_ID;
  var PLACEHOLDER_PREFIX = '__adv__';

  function ratingOf(id) {
    return (state.ratings && state.ratings[id] != null) ? state.ratings[id] : TEAM_BY_ID[id].vrs;
  }
  function seedRankOf(id) { return TEAM_BY_ID[id].rank; }
  function isPlaceholder(id) { return id.indexOf(PLACEHOLDER_PREFIX) === 0; }
  function placeholders(stage) {
    var a = []; for (var i = 0; i < 8; i++) a.push(PLACEHOLDER_PREFIX + stage + '-' + i); return a;
  }

  function newStage(stage) {
    var st = {
      picks: {}, nextPicks: {}, rounds: null, records: null, advances: null, eliminated: null, adv: {},
      r1Arr: stage === 1 ? D.STAGE1_R1.map(function (p) { return p.slice(); }) : null
    };
    if (stage === 1) {
      st.pool = D.TEAMS.filter(function (t) { return t.stage === 1; })
        .sort(function (a, b) { return a.rank - b.rank; }).map(function (t) { return t.id; });
    } else {
      st.pool = { invited: D.INVITED[stage].slice(), adv: placeholders(stage) };
    }
    return st;
  }

  var state = {
    page: 'overview',
    stages: { 1: newStage(1), 2: newStage(2), 3: newStage(3) },
    po: null,
    fullMC: null,
    pendingComplete: null,
    reported: false,
    ratings: {},     // 动态实力评分（随战绩浮动）
    upsetList: [],   // 已打完比赛的赛前胜率（用于爆冷统计）
    favorites: {}   // 右键关注的高亮战队
  };

  // 瑞士轮战绩分组列顺序 (按进入该组时的战绩)
  var GROUP_ORDER = ['0-0', '1-0', '0-1', '2-0', '1-1', '0-2', '2-1', '1-2', '2-2'];

  // ---------------- 动态实力评分 ----------------
  // 按时间顺序回放所有已打比赛，用 Elo 修正每队评分：连胜/爆冷会明显改变后续概率
  var RATING_K = 34;
  function recomputeRatings() {
    var r = {};
    D.TEAMS.forEach(function (t) { r[t.id] = t.vrs; });
    var ups = [];
    function upd(a, b, winner) {
      if (!a || !b || !winner) return;
      var ra = r[a], rb = r[b];
      var ea = 1 / (1 + Math.pow(10, (rb - ra) / S));
      var swing = RATING_K * (1 - ea);
      ups.push({ winner: winner, loser: winner === a ? b : a, p: winner === a ? ea : 1 - ea });
      if (winner === a) { r[a] = ra + swing; r[b] = rb - swing; }
      else { r[b] = rb + swing; r[a] = ra - swing; }
    }
    [1, 2, 3].forEach(function (s) {
      var st = state.stages[s];
      if (!st.rounds) return;
      st.rounds.forEach(function (round) { round.forEach(function (m) { upd(m.a, m.b, m.winner); }); });
    });
    if (state.po) {
      var m = state.po.matches;
      m.qf.forEach(function (q) { upd(q.a, q.b, q.win); });
      m.sf.forEach(function (q) { upd(q.a, q.b, q.win); });
      if (m.tp) upd(m.tp.a, m.tp.b, m.tp.win);
      if (m.gf) upd(m.gf.a, m.gf.b, m.gf.win);
    }
    state.ratings = r;
    state.upsetList = ups;
  }

  function poolIds(stage) {
    var st = state.stages[stage];
    return stage === 1 ? st.pool : st.pool.invited.concat(st.pool.adv);
  }
  function realPoolIds(stage) {
    return poolIds(stage).filter(function (id) { return !isPlaceholder(id); });
  }
  function poolComplete(stage) { return realPoolIds(stage).length === 16; }
  function initR1(stage) {
    var st = state.stages[stage];
    if (st.r1Arr && st.r1Arr.length === 8) return st.r1Arr;
    if (!poolComplete(stage)) { st.r1Arr = null; return null; }
    st.r1Arr = SIM.vrsPairing(realPoolIds(stage), ratingOf);
    return st.r1Arr;
  }

  // ---------------- 工具 ----------------
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function isFav(id) { return !!state.favorites[id]; }
  function toggleFav(id) {
    if (state.favorites[id]) delete state.favorites[id];
    else state.favorites[id] = true;
  }

  function logoEl(id, sizeCls) {
    var t = TEAM_BY_ID[id];
    var e = h('div', 'logo' + (t.dark ? ' dark-text' : '') + (isFav(id) ? ' fav' : ''));
    e.style.background = t.color;
    var url = D.LOGOS && D.LOGOS[id];
    if (url) {
      var img = document.createElement('img');
      img.className = 'logo-img';
      img.src = url;
      img.referrerPolicy = 'no-referrer';
      img.loading = 'lazy';
      img.alt = '';
      img.onerror = function () { if (img.parentNode) { img.parentNode.removeChild(img); e.textContent = t.abbr; } };
      e.appendChild(img);
    } else {
      e.textContent = t.abbr;
    }
    e.title = t.name + ' · VRS ' + t.vrs + ' (#' + t.rank + ')' + (isFav(id) ? ' · ⭐已关注' : '');
    return e;
  }

  // 合理比分 (用于手动判定的比赛)
  function plausibleScore(a, b, winner, bo, rng) {
    var need = (bo + 1) / 2;
    var loser = winner === a ? b : a;
    var lw = Math.floor(rng() * need); // 败者拿 0..need-1 图
    var wa = winner === a ? need : lw;
    var wb = winner === b ? need : lw;
    return [wa, wb];
  }

  // ---------------- 瑞士轮(可交互) ----------------
  function fixedFromRounds(rounds) {
    return rounds.map(function (r) {
      return {
        pairs: r.map(function (m) { return [m.a, m.b]; }),
        winners: r.map(function (m) { return m.winner; })
      };
    });
  }

  function buildSwissFrom(ids, r1Pairs, bestOf, rng, fixed, maxRounds) {
    var rec = {}, opp = {};
    ids.forEach(function (id) { rec[id] = [0, 0]; opp[id] = {}; });
    function played(a, b) { return !!opp[a][b]; }
    var rounds = [], limit = maxRounds || 5;
    for (var r = 0; r < limit; r++) {
      var active = ids.filter(function (id) { return rec[id][0] < 3 && rec[id][1] < 3; });
      if (active.length === 0) break;
      var pairs, winners;
      if (fixed && fixed[r]) {
        pairs = fixed[r].pairs; winners = fixed[r].winners;
      } else if (r === 0 && r1Pairs) {
        pairs = r1Pairs.slice(); winners = null;
      } else {
        var groups = {};
        active.forEach(function (id) {
          var k = rec[id][0] + '-' + rec[id][1];
          (groups[k] = groups[k] || []).push(id);
        });
        pairs = [];
        for (var g in groups) pairs = pairs.concat(SIM.pairPool(groups[g], seedRankOf, played));
        winners = null;
      }
      var res = pairs.map(function (pair, mi) {
        var a = pair[0], b = pair[1];
        var grp = rec[a][0] + '-' + rec[a][1]; // 进入该组时的战绩
        var winner, manual = false, score;
        if (winners && winners[mi]) { winner = winners[mi]; manual = true; score = plausibleScore(a, b, winner, bestOf, rng); }
        else { var m = SIM.playMatch(a, b, ratingOf, bestOf, S, rng); winner = m.winner; score = m.score; }
        var loser = winner === a ? b : a;
        rec[winner][0]++; rec[loser][1]++;
        opp[a][b] = true; opp[b][a] = true;
        return { a: a, b: b, winner: winner, loser: loser, score: score, bo: bestOf, round: r + 1, manual: manual, group: grp };
      });
      rounds.push(res);
    }
    var bu = {};
    ids.forEach(function (id) {
      var s = 0; for (var o in opp[id]) s += rec[o][0]; bu[id] = s;
    });
    var advances = ids.filter(function (id) { return rec[id][0] === 3; });
    var eliminated = ids.filter(function (id) { return rec[id][1] === 3; });
    function cmp(x, y) {
      var wx = rec[x][0], wy = rec[y][0];
      if (wx !== wy) return wy - wx;
      if (bu[x] !== bu[y]) return bu[y] - bu[x];
      return seedRankOf(x) - seedRankOf(y);
    }
    advances.sort(cmp); eliminated.sort(cmp);
    return { rounds: rounds, records: rec, buchholz: bu, advances: advances, eliminated: eliminated, order: advances.concat(eliminated) };
  }

  function applyResult(stage, result) {
    var st = state.stages[stage];
    st.rounds = result.rounds;
    st.records = result.records;
    st.advances = result.advances;
    st.eliminated = result.eliminated;
    st.picks = {};
    st.nextPicks = {};
  }

  function clearResults(stage) {
    var st = state.stages[stage];
    st.rounds = null; st.records = null; st.advances = null; st.eliminated = null; st.picks = {}; st.adv = {};
    st.nextPicks = {};
    st.advInit = false;
  }

  function chainAfter(stage) {
    var st = state.stages[stage];
    if (!st.advances) return;
    if (stage === 1) {
      state.stages[2].pool.adv = st.advances.slice();
      state.stages[2].r1Arr = null;
      clearResults(2);
      clearResults(3);
      state.stages[3].pool.adv = placeholders(3);
      state.stages[3].r1Arr = null;
      state.po = null;
    } else if (stage === 2) {
      state.stages[3].pool.adv = st.advances.slice();
      state.stages[3].r1Arr = null;
      clearResults(3);
      state.po = null;
    } else if (stage === 3) {
      buildPlayoffs(st.advances.slice());
    }
  }

  function resetStage(stage) {
    var st = state.stages[stage];
    st.rounds = null; st.records = null; st.advances = null; st.eliminated = null; st.picks = {}; st.adv = {};
    st.nextPicks = {};
    st.r1Arr = stage === 1 ? D.STAGE1_R1.map(function (p) { return p.slice(); }) : null;
    for (var s = stage + 1; s <= 3; s++) {
      clearResults(s);
      state.stages[s].r1Arr = null;
      state.stages[s].pool.adv = placeholders(s);
    }
    state.po = null;
    state.reported = false;
    computeAdv(stage);
  }

  // 阶段锁定：本阶段已完成，且下一阶段已经开打至少一轮
  function stageLocked(stage) {
    var st = state.stages[stage];
    if (!st.rounds || st.rounds.length < 5) return false;
    if (stage < 3) {
      var nx = state.stages[stage + 1];
      return !!(nx.rounds && nx.rounds.length >= 1);
    }
    if (!state.po || !state.po.matches) return false;
    return state.po.matches.qf.some(function (q) { return !!q.win; });
  }

  function stageFixed(stage) {
    var st = state.stages[stage];
    if (st.rounds) {
      var f = fixedFromRounds(st.rounds);
      var nr = nextPairs(stage);
      if (nr) {
        f.push({
          pairs: nr.pairs,
          winners: nr.pairs.map(function (p, i) { return st.nextPicks[i] || null; })
        });
      }
      return f;
    }
    var r1 = initR1(stage);
    return [{ pairs: r1, winners: r1.map(function (p, mi) { return st.picks[mi] || null; }) }];
  }

  // 模拟一轮
  function simulateRound(stage) {
    if (!poolComplete(stage)) { toast('请先完成上一阶段，8支晋级战队才会进入本阶段'); return; }
    var st = state.stages[stage];
    if (st.rounds && st.rounds.length >= 5) return;
    var ids = realPoolIds(stage);
    var r1 = initR1(stage);
    var fixed = stageFixed(stage);
    var maxRounds = (st.rounds ? st.rounds.length : 0) + 1;
    var rng = SIM.mulberry32((Date.now() ^ (stage * 7919)) >>> 0);
    var result = buildSwissFrom(ids, r1, D.STAGES[stage].bo, rng, fixed, maxRounds);
    applyResult(stage, result);
    if (result.rounds.length >= 5) {
      chainAfter(stage);
      computeAdv(stage);
      renderCurrent();
      openComplete(stage);
    } else {
      computeAdv(stage);
      renderCurrent();
      toast('第 ' + result.rounds.length + ' 轮完成 · 第 ' + (result.rounds.length + 1) + ' 轮对阵已排好，可在下方点选胜者');
      setTimeout(function () {
        if (typeof document.querySelector !== 'function') return;
        var wrap = document.querySelector('.pickem-stage .ladder-wrap');
        var card = document.querySelector('.pickem-stage .match.pending');
        if (!wrap || !card || !card.parentNode) return;
        var col = card.parentNode;
        var left = col.offsetLeft || 0;
        if (left < wrap.scrollLeft || left > wrap.scrollLeft + (wrap.clientWidth || 0) - 170) {
          wrap.scrollLeft = Math.max(0, left - 12);
        }
      }, 80);
    }
  }

  // 模拟到完赛 (从当前已模拟轮次继续)
  function simulateStage(stage) {
    if (!poolComplete(stage)) { toast('请先完成上一阶段，8支晋级战队才会进入本阶段'); return; }
    var st = state.stages[stage];
    var ids = realPoolIds(stage);
    var r1 = initR1(stage);
    var fixed = stageFixed(stage);
    var rng = SIM.mulberry32((Date.now() ^ (stage * 7919)) >>> 0);
    var result = buildSwissFrom(ids, r1, D.STAGES[stage].bo, rng, fixed);
    applyResult(stage, result);
    chainAfter(stage);
    computeAdv(stage);
    renderCurrent();
    if (result.advances && result.advances.length === 8) openComplete(stage);
  }

  function overrideWinner(stage, roundIdx, mi, winnerId) {
    var st = state.stages[stage];
    if (!st.rounds || !st.rounds[roundIdx]) return;
    var m = st.rounds[roundIdx][mi];
    if (!m || m.winner === winnerId) return;
    m.winner = winnerId; m.loser = (winnerId === m.a ? m.b : m.a);
    m.manual = true;
    m.score = plausibleScore(m.a, m.b, winnerId, m.bo, SIM.mulberry32(Date.now() >>> 0));
    var frontier = st.rounds.length; // 保持当前已模拟的轮次深度
    var ids = realPoolIds(stage);
    var r1 = initR1(stage);
    var fixed = fixedFromRounds(st.rounds.slice(0, roundIdx + 1));
    var result = buildSwissFrom(ids, r1, D.STAGES[stage].bo, SIM.mulberry32((Date.now() ^ 331) >>> 0), fixed, frontier);
    st.rounds = st.rounds.slice(0, roundIdx + 1).concat(result.rounds.slice(roundIdx + 1));
    st.records = result.records; st.advances = result.advances; st.eliminated = result.eliminated;
    if (st.rounds.length >= 5) chainAfter(stage);
    computeAdv(stage);
    renderCurrent();
    toast('已改判并重算第 ' + (roundIdx + 1) + ' 轮起的后续' + (st.rounds.length >= 5 ? '（已同步下一阶段）' : '轮次'));
  }

  // ---------------- 实时晋级概率 ----------------
  var advTimer = {};
  function scheduleAdv(stage) {
    clearTimeout(advTimer[stage]);
    advTimer[stage] = setTimeout(function () { computeAdv(stage); renderCurrent(); }, 130);
  }
  function computeAdv(stage) {
    recomputeRatings();
    var st = state.stages[stage];
    var ids = realPoolIds(stage);
    if (ids.length !== 16) return;
    if (st.rounds && st.rounds.length === 5) {
      // 已完赛: 确定性
      ids.forEach(function (id) { st.adv[id] = (st.advances && st.advances.indexOf(id) >= 0) ? 1 : 0; });
      return;
    }
    var r1 = initR1(stage);
    var fixed = stageFixed(stage);
    var N = 2000, cnt = {};
    ids.forEach(function (id) { cnt[id] = 0; });
    var rng = SIM.mulberry32(2026 * 100 + stage * 7 + (st.rounds ? st.rounds.length : 0));
    for (var i = 0; i < N; i++) {
      var r = buildSwissFrom(ids, r1, D.STAGES[stage].bo, rng, fixed);
      r.advances.forEach(function (id) { cnt[id]++; });
    }
    ids.forEach(function (id) { st.adv[id] = cnt[id] / N; });
  }

  // ---------------- 季后赛 ----------------
  function buildPlayoffs(eight) {
    state.reported = false;
    var matches = {
      qf: [{ a: null, b: null, win: null }, { a: null, b: null, win: null },
           { a: null, b: null, win: null }, { a: null, b: null, win: null }],
      sf: [{ a: null, b: null, win: null }, { a: null, b: null, win: null }],
      tp: { a: null, b: null, win: null }, gf: { a: null, b: null, win: null }
    };
    [[0, 7], [3, 4], [1, 6], [2, 5]].forEach(function (s, i) {
      matches.qf[i].a = eight[s[0]]; matches.qf[i].b = eight[s[1]];
    });
    state.po = { eight: eight, matches: matches };
  }
  function propagateManual(matchKey, winnerId) {
    var m = state.po.matches;
    if (matchKey.indexOf('qf') === 0) {
      var qi = parseInt(matchKey.slice(2), 10);
      m.qf[qi].win = winnerId;
      var t = qi < 2 ? m.sf[0] : m.sf[1];
      if (!t.a) t.a = winnerId; else if (t.a !== winnerId && !t.b) t.b = winnerId; else if (!t.b) t.b = winnerId;
      if (t.win && t.win !== t.a && t.win !== t.b) t.win = null;
    } else if (matchKey === 'sf0' || matchKey === 'sf1') {
      var sm = matchKey === 'sf0' ? m.sf[0] : m.sf[1];
      sm.win = winnerId;
      if (!m.gf.a || m.gf.a === winnerId) m.gf.a = winnerId; else m.gf.b = winnerId;
      if (m.gf.win && m.gf.win !== m.gf.a && m.gf.win !== m.gf.b) m.gf.win = null;
    } else if (matchKey === 'gf') { m.gf.win = winnerId; }
    else if (matchKey === 'tp') { m.tp.win = winnerId; }
  }

  // ---------------- 完赛弹窗 ----------------
  function openComplete(stage) {
    var st = state.stages[stage];
    state.pendingComplete = stage;
    var names = { 1: '第一阶段', 2: '第二阶段', 3: '第三阶段' };
    document.getElementById('modal-title').textContent = names[stage] + '完赛 ✅';
    document.getElementById('modal-sub').textContent = '以下 8 支战队晋级，是否按此结果进行下一阶段模拟？';
    var wrap = document.getElementById('modal-teams');
    wrap.innerHTML = '';
    st.advances.forEach(function (id) {
      var c = h('div', 'bchip');
      c.appendChild(logoEl(id));
      c.appendChild(h('span', 'rec', st.records[id][0] + '-' + st.records[id][1]));
      c.appendChild(h('span', '', TEAM_BY_ID[id].name));
      wrap.appendChild(c);
    });
    document.getElementById('modal').classList.add('show');
  }
  function closeComplete() { document.getElementById('modal').classList.remove('show'); state.pendingComplete = null; }

  // ---------------- 渲染 ----------------
  function renderCurrent() {
    recomputeRatings();
    ['overview', 's1', 's2', 's3', 'po', 'sum'].forEach(function (p) {
      document.getElementById('page-' + p).classList.toggle('active', state.page === p);
    });
    var steps = document.querySelectorAll('.step');
    steps.forEach(function (s) {
      s.classList.toggle('active', s.dataset.page === state.page);
      var locked = /^s[123]$/.test(s.dataset.page) && stageLocked(parseInt(s.dataset.page.slice(1), 10));
      s.classList.toggle('locked', locked);
    });
    if (state.page === 'overview') renderOverview();
    else if (state.page === 'po') renderPlayoffs();
    else if (state.page === 'sum') renderSummary();
    else renderStagePage(parseInt(state.page.slice(1), 10));
  }

  function renderOverview() {
    var c = document.getElementById('champion-odds');
    c.innerHTML = '';
    if (!state.fullMC) { c.appendChild(h('div', 'hint', '正在运行全赛程蒙特卡洛…')); return; }
    state.fullMC.champOdds.slice(0, 14).forEach(function (o, i) {
      var t = TEAM_BY_ID[o.id];
      var row = h('div', 'odds-row');
      row.appendChild(h('span', 'odds-rank', String(i + 1)));
      row.appendChild(logoEl(o.id));
      row.appendChild(h('span', 'nm', t.name));
      var bar = h('div', 'odds-bar'); var fill = h('div', 'odds-fill');
      fill.style.width = (o.p / state.fullMC.champOdds[0].p * 100).toFixed(1) + '%';
      bar.appendChild(fill); row.appendChild(bar);
      row.appendChild(h('span', 'odds-pct', (o.p * 100).toFixed(1) + '%'));
      c.appendChild(row);
    });
  }

  // ---------------- Pick'Em 皮肤辅助 ----------------
  var EVENT_START = Date.parse('2026-11-24T00:00:00+08:00');
  function timerText() {
    var days = Math.ceil((EVENT_START - Date.now()) / 86400000);
    if (days > 0) return '⏱ 还剩 ' + days + ' 天可以竞猜';
    if (days > -21) return '⏱ 比赛进行中';
    return '⏱ 赛事已结束';
  }

  function stageZones(stage) {
    var st = state.stages[stage];
    var z = { p30: [], p31: [], e03: [], e13: [], e23: [] };
    if (!st.records) return z;
    Object.keys(st.records).forEach(function (id) {
      var w = st.records[id][0], l = st.records[id][1];
      if (w === 3 && l === 0) z.p30.push(id);
      else if (w === 3) z.p31.push(id);
      else if (l === 3 && w === 0) z.e03.push(id);
      else if (l === 3 && w === 1) z.e13.push(id);
      else if (l === 3 && w === 2) z.e23.push(id);
    });
    return z;
  }

  // 当前已模拟轮次之后，下一轮的对阵（与 buildSwissFrom 的配对逻辑一致）
  function nextPairs(stage) {
    var st = state.stages[stage];
    if (!st.rounds || !st.rounds.length || st.rounds.length >= 5) return null;
    if (!poolComplete(stage)) return null;
    var ids = realPoolIds(stage);
    var rec = {}, opp = {};
    ids.forEach(function (id) { rec[id] = [0, 0]; opp[id] = {}; });
    st.rounds.forEach(function (round) {
      round.forEach(function (m) {
        rec[m.winner][0]++; rec[m.loser][1]++;
        opp[m.a][m.b] = true; opp[m.b][m.a] = true;
      });
    });
    var active = ids.filter(function (id) { return rec[id][0] < 3 && rec[id][1] < 3; });
    if (!active.length) return null;
    var groups = {};
    active.forEach(function (id) {
      var k = rec[id][0] + '-' + rec[id][1];
      (groups[k] = groups[k] || []).push(id);
    });
    var pairs = [];
    Object.keys(groups).forEach(function (k) {
      pairs = pairs.concat(SIM.pairPool(groups[k], seedRankOf, function (a, b) { return !!opp[a][b]; }));
    });
    return { pairs: pairs, rec: rec, round: st.rounds.length + 1 };
  }

  function flashSaved() {
    var b = document.getElementById('saved-badge');
    if (!b) return;
    b.classList.add('show');
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(function () { b.classList.remove('show'); }, 1600);
  }

  // 下一轮的对阵卡（还没打，可点选胜者）
  function nextMatchCard(stage, idx, pair) {
    var st = state.stages[stage];
    var card = h('div', 'match pending');
    card.appendChild(h('div', 'm-tag', 'BO' + D.STAGES[stage].bo + ' · 待选'));
    ['a', 'b'].forEach(function (side) {
      var id = side === 'a' ? pair[0] : pair[1];
      var other = side === 'a' ? pair[1] : pair[0];
      card.appendChild(mrow(id, {
        short: true, clickable: true,
        prob: SIM.pWin(ratingOf(id), ratingOf(other), S),
        picked: st.nextPicks[idx] === id,
        stage: stage, mi: idx, side: side, mode: 'next', round: 0
      }));
    });
    return card;
  }

  function zonesPanel(stage) {
    var z = stageZones(stage);
    var wrap = h('div', 'zones');
    function zone(cls, title, ids, need) {
      var b = h('div', 'zone ' + cls);
      b.appendChild(h('div', 'zone-title', title));
      var row = h('div', 'zone-teams');
      if (ids.length) {
        ids.forEach(function (id) {
          var c = h('div', 'zone-team');
          c.dataset.id = id;
          c.appendChild(logoEl(id));
          c.appendChild(h('span', '', TEAM_BY_ID[id].abbr));
          row.appendChild(c);
        });
      } else {
        for (var i = 0; i < need; i++) row.appendChild(h('span', 'zone-q', '?'));
      }
      b.appendChild(row);
      return b;
    }
    wrap.appendChild(zone('adv', '3:0 · 晋级', z.p30, 2));
    wrap.appendChild(zone('adv', '3:1 / 3:2 · 晋级', z.p31, 6));
    wrap.appendChild(zone('elim', '0:3 · 淘汰', z.e03, 2));
    wrap.appendChild(zone('elim', '1:3 · 淘汰', z.e13, 3));
    wrap.appendChild(zone('elim', '2:3 · 淘汰', z.e23, 3));
    return wrap;
  }

  function renderStagePage(stage) {
    var sec = document.getElementById('page-s' + stage);
    sec.innerHTML = '';
    sec.classList.add('pickem-stage');
    var st = state.stages[stage];
    var cfg = D.STAGES[stage];
    var setup = !st.rounds;
    var complete = poolComplete(stage);
    var ids = realPoolIds(stage);
    var r1 = setup ? initR1(stage) : st.rounds[0];
    // 首次进入设定模式时, 惰性计算一次实时晋级概率
    if (setup && complete && !st.advInit) { st.advInit = true; scheduleAdv(stage); }

    // 顶部：倒计时 + 选择已保存
    var top = h('div', 'pickem-topbar');
    top.appendChild(h('span', 'pickem-timer', timerText()));
    var badge = h('span', 'saved-badge', '✓ 选择已保存');
    badge.id = 'saved-badge';
    top.appendChild(badge);
    sec.appendChild(top);

    // 头部
    var head = h('div', 'stage-head');
    head.appendChild(h('h2', '', (stage === 1 ? '① ' : stage === 2 ? '② ' : '③ ') + cfg.name));
    head.appendChild(h('span', 'meta', cfg.dates));
    head.appendChild(h('span', 'bo', cfg.boLabel));
    var prog = h('span', 'progress', '轮次');
    var dots = h('span', 'dots', '');
    for (var di = 0; di < 5; di++) {
      var dot = h('span', 'dot' + (st.rounds && st.rounds.length > di ? ' on' : ''));
      dots.appendChild(dot);
    }
    prog.appendChild(dots);
    head.appendChild(prog);
    sec.appendChild(head);
    sec.appendChild(h('div', 'hint', cfg.note));

    // 控制区
    var ctrl = h('div', 'stage-ctrl');
    var curRounds = st.rounds ? st.rounds.length : 0;
    var done = curRounds >= 5;
    var bRound = h('button', 'btn primary', done ? '已完成' : '▶ 模拟下一轮' + (curRounds > 0 ? '（第 ' + (curRounds + 1) + ' 轮）' : ''));
    bRound.disabled = !complete || done;
    bRound.addEventListener('click', function () { simulateRound(stage); });
    ctrl.appendChild(bRound);
    var bEnd = h('button', 'btn', '⏩ 模拟到完赛');
    bEnd.disabled = !complete || done;
    bEnd.addEventListener('click', function () { simulateStage(stage); });
    ctrl.appendChild(bEnd);
    var bReset = h('button', 'btn warn', '↺ 重置本阶段');
    bReset.addEventListener('click', function () { resetStage(stage); renderCurrent(); toast('已重置'); });
    ctrl.appendChild(bReset);
    ctrl.appendChild(h('span', 'sep', ''));
    ctrl.appendChild(h('span', 'hint', (setup ? '把战队点选/拖到 0:0 组对阵槽 → 点队伍选胜者 → 「模拟下一轮」逐步推进' : '浅绿虚线对阵=下一轮，点队伍可直接选胜者；已打完的场次点一下可改判') + (Object.keys(state.favorites).length ? ' · ⭐关注 ' + Object.keys(state.favorites).length + ' 队' : '') + ' · 战绩列可左右滑动'));
    sec.appendChild(ctrl);

    // 下一轮对阵（直接以对阵卡形式排进梯子，可点选胜者）
    var nr = nextPairs(stage);

    var grid = h('div', 'stage-grid');

    // 左：战队池（只有排阵阶段需要）
    if (setup) {
      var poolCol = h('div', 'pool-col');
      poolCol.appendChild(poolPanel(stage));
      grid.appendChild(poolCol);
    }

    // 中：按战绩分组的梯形对阵 (0:0 / 1:0 / 0:1 / ...)
    var ladderWrap = h('div', 'ladder-wrap');
    var ladder = h('div', 'ladder');
    if (!complete) {
      ladder.appendChild(h('div', 'round-pending', '请先完成上一阶段模拟，战队池才会补全'));
    } else {
      var byGroup = {};
      GROUP_ORDER.forEach(function (g) { byGroup[g] = []; });
      if (setup) {
        (r1 || []).forEach(function (p, mi) { byGroup['0-0'].push({ setup: true, mi: mi, pair: p }); });
      } else {
        st.rounds.forEach(function (round) {
          round.forEach(function (m, mi) {
            var g = m.group || '0-0';
            if (byGroup[g]) byGroup[g].push({ setup: false, round: m.round - 1, mi: mi, m: m });
          });
        });
      }
      function buildCol(g) {
        var elim = g === '0-3' || g === '1-3' || g === '2-3';
        var col = h('div', 'pcol ' + (elim ? 'pcol-elim' : 'pcol-adv'));
        var ph = h('div', 'pcol-head');
        ph.appendChild(h('span', 'pcol-label', g.replace('-', ':')));
        ph.appendChild(h('span', 'pcol-tag', elim ? '淘汰' : (g === '2-2' ? '决胜' : 'BO' + cfg.bo)));
        col.appendChild(ph);
        var items = byGroup[g] || [];
        var pending = [];
        if (nr) {
          nr.pairs.forEach(function (p, idx) {
            var pg = nr.rec[p[0]][0] + '-' + nr.rec[p[0]][1];
            if (pg === g) pending.push({ idx: idx, pair: p });
          });
        }
        if (items.length === 0 && pending.length === 0) {
          col.appendChild(h('div', 'pmatch-empty', '? 对阵 ?'));
        } else {
          items.forEach(function (it) {
            if (it.setup) col.appendChild(setupMatchCard(stage, it.mi, it.pair));
            else col.appendChild(resultMatchCard(stage, it.round, it.mi, it.m));
          });
          pending.forEach(function (it) { col.appendChild(nextMatchCard(stage, it.idx, it.pair)); });
        }
        return col;
      }
      // 战绩列按轮次分带：同轮的多列上下排列（1-0 在上、0-1 在下）
      var ROUNDS = [['0-0'], ['1-0', '0-1'], ['2-0', '1-1', '0-2'], ['2-1', '1-2'], ['2-2']];
      ROUNDS.forEach(function (groups, ri) {
        var band = h('div', 'round-band');
        groups.forEach(function (g) { band.appendChild(buildCol(g)); });
        ladder.appendChild(band);
        if (ri < ROUNDS.length - 1) ladder.appendChild(h('div', 'band-arrow', '▸'));
      });
    }
    ladderWrap.appendChild(ladder);
    grid.appendChild(ladderWrap);

    // 右：实时晋级概率
    var probCol = h('div', 'prob-col');
    probCol.appendChild(probPanel(stage));
    grid.appendChild(probCol);

    sec.appendChild(grid);

    // 晋级 / 淘汰区
    sec.appendChild(zonesPanel(stage));
  }

  function setupMatchCard(stage, mi, pair) {
    var st = state.stages[stage];
    var card = h('div', 'match');
    card.appendChild(h('div', 'm-tag', 'BO' + D.STAGES[stage].bo));
    var a = pair && pair[0], b = pair && pair[1];
    ['a', 'b'].forEach(function (side) {
      var id = side === 'a' ? a : b;
      var other = side === 'a' ? b : a;
      var row = mrow(id, {
        empty: !id, draggable: !!id, clickable: !!id, clearable: !!id, short: true, picked: st.picks[mi] === id,
        prob: (id && other) ? SIM.pWin(ratingOf(id), ratingOf(other), S) : undefined,
        stage: stage, mi: mi, side: side, mode: 'setup', round: 0
      });
      card.appendChild(row);
    });
    return card;
  }

  // 某队在第 r 轮开始前的战绩（用于对阵卡片显示）
  function recordBefore(stage, r, id) {
    var st = state.stages[stage];
    var w = 0, l = 0;
    for (var i = 0; i < r && st.rounds && i < st.rounds.length; i++) {
      st.rounds[i].forEach(function (m) {
        if (m.a !== id && m.b !== id) return;
        if (m.winner === id) w++; else l++;
      });
    }
    return w + '-' + l;
  }

  function resultMatchCard(stage, r, mi, m) {
    var card = h('div', 'match played');
    card.appendChild(h('div', 'm-tag', 'BO' + m.bo + (m.manual ? ' · 🔒' : '')));
    ['a', 'b'].forEach(function (side) {
      var id = m[side];
      var rec = recordBefore(stage, r, id);
      card.appendChild(mrow(id, {
        winner: m.winner === id, loser: m.winner && m.winner !== id,
        score: side === 'a' ? m.score[0] : m.score[1],
        record: rec,
        short: true,
        clickable: true, stage: stage, mi: mi, side: side, mode: 'result', round: r
      }));
    });
    return card;
  }

  function mrow(id, o) {
    var e = h('div', 'mrow team' + (o.empty ? ' empty' : '') + (o.winner ? ' winner' : '') + (o.loser ? ' loser' : '') + (o.picked ? ' picked' : '') + (id && isFav(id) ? ' fav' : ''));
    if (o.empty) {
      e.textContent = '拖入 / 点选队伍';
      e.dataset.empty = '1';
    } else {
      e.appendChild(logoEl(id));
      var label = o.short ? TEAM_BY_ID[id].abbr : TEAM_BY_ID[id].name;
      var nameEl = h('span', 'tname', label);
      nameEl.title = TEAM_BY_ID[id].name;
      e.appendChild(nameEl);
      if (o.record) e.appendChild(h('span', 'trec', o.record));
      if (o.prob !== undefined) e.appendChild(h('span', 'tprob', Math.round(o.prob * 100) + '%'));
      if (o.score !== undefined) e.appendChild(h('span', 'score', String(o.score)));
      e.dataset.id = id;
      if (o.clickable) e.classList.add('pick');
      if (o.draggable) e.classList.add('drag');
      if (o.clearable && o.mode === 'setup') {
        var x = h('span', 'slot-x', '×');
        x.title = '把队伍移出这个槽位';
        e.appendChild(x);
      }
    }
    e.dataset.stage = o.stage;
    e.dataset.mi = o.mi;
    e.dataset.side = o.side;
    e.dataset.mode = o.mode;
    e.dataset.round = o.round;
    return e;
  }

  function poolPanel(stage) {
    var p = h('div', 'panel');
    p.appendChild(h('div', 'panel-title', '战队池 · 拖到第1轮对阵槽（点选胜者）'));
    var pool = h('div', 'pool');
    pool.dataset.pool = stage;
    var st = state.stages[stage];
    var ids = poolIds(stage);
    var real = realPoolIds(stage);
    var complete = poolComplete(stage);
    var placed = {};
    (state.stages[stage].r1Arr || []).forEach(function (pr) { if (pr && pr[0]) placed[pr[0]] = true; if (pr && pr[1]) placed[pr[1]] = true; });
    var setup = !st.rounds;
    var seedOrder = real.slice().sort(function (a, b) { return seedRankOf(a) - seedRankOf(b); });
    var chipCount = 0;
    ids.forEach(function (id) {
      if (isPlaceholder(id)) {
        var ph = h('div', 'pchip placeholder', '待定');
        ph.title = '上一阶段模拟完成后自动填入';
        pool.appendChild(ph);
      } else if (setup && placed[id]) {
        // 已放入对阵槽
      } else {
        chipCount++;
        var chip = h('div', 'pchip' + (isFav(id) ? ' fav' : ''));
        chip.appendChild(logoEl(id));
        chip.appendChild(h('span', '', TEAM_BY_ID[id].abbr));
        if (st.adv[id] !== undefined && real.length === 16) {
          chip.appendChild(h('span', 'adv', (st.adv[id] * 100).toFixed(0) + '%'));
        }
        chip.dataset.id = id;
        chip.dataset.stage = stage;
        if (setup && complete) chip.classList.add('drag');
        pool.appendChild(chip);
      }
    });
    p.appendChild(pool);
    if (complete && chipCount === 0) {
      p.appendChild(h('div', 'pool-empty', setup
        ? '16 队已按官方首轮对阵排好 · 点对阵里的 × 可移回池子重排'
        : '所有队伍都已放入对阵'));
    }
    return p;
  }

  function probPanel(stage) {
    var p = h('div', 'panel');
    p.appendChild(h('div', 'panel-title', '晋级概率（实时 · 随战绩浮动）'));
    var st = state.stages[stage];
    var ids = realPoolIds(stage);
    if (ids.length !== 16) {
      p.appendChild(h('div', 'hint', '待上一阶段完成后计算'));
      return p;
    }
    var list = h('div', 'prob-list');
    var rows = ids.slice().sort(function (a, b) { return (st.adv[b] || 0) - (st.adv[a] || 0); });
    rows.forEach(function (id) {
      var row = h('div', 'prob-row' + (isFav(id) ? ' fav' : ''));
      row.dataset.id = id;
      row.appendChild(logoEl(id));
      row.appendChild(h('span', 'nm', TEAM_BY_ID[id].name));
      var bar = h('div', 'prob-bar'); var fill = h('div', 'prob-fill');
      fill.style.width = ((st.adv[id] || 0) * 100).toFixed(1) + '%';
      bar.appendChild(fill); row.appendChild(bar);
      row.appendChild(h('span', 'pv', ((st.adv[id] || 0) * 100).toFixed(1) + '%'));
      list.appendChild(row);
    });
    p.appendChild(list);
    return p;
  }

  function bucketEl(stage, adv, ids) {
    var b = h('div', 'bucket ' + (adv ? 'adv' : 'elim'));
    b.appendChild(h('div', 'bucket-title', adv ? '晋级 → ' + (stage < 3 ? '下一阶段' : '季后赛') : '淘汰'));
    var st = state.stages[stage];
    var teams = h('div', 'teams');
    ids.forEach(function (id) {
      var c = h('div', 'bchip' + (isFav(id) ? ' fav' : ''));
      c.appendChild(logoEl(id));
      c.appendChild(h('span', 'rec', st.records[id][0] + '-' + st.records[id][1]));
      c.appendChild(h('span', '', TEAM_BY_ID[id].name));
      teams.appendChild(c);
    });
    b.appendChild(teams);
    return b;
  }

  // ---------------- 季后赛渲染 ----------------
  function renderPlayoffs() {
    var sec = document.getElementById('page-po');
    sec.innerHTML = '';
    var head = h('div', 'stage-head');
    head.appendChild(h('h2', '', '🏅 季后赛'));
    head.appendChild(h('span', 'meta', D.PLAYOFFS.dates + ' · ' + D.PLAYOFFS.venue));
    head.appendChild(h('span', 'bo', 'QF/SF BO3 · 三四名BO3 · 决赛BO5'));
    sec.appendChild(head);
    sec.appendChild(h('div', 'hint', D.PLAYOFFS.note + ' · 种子 1v8 · 4v5 · 2v7 · 3v6'));
    if (!state.po) {
      sec.appendChild(h('div', 'hint', '第三阶段模拟完成后，8支晋级战队自动进入季后赛。也可点「一键全赛程预测」生成。'));
      renderPoOdds(sec);
      return;
    }
    var ctrl = h('div', 'stage-ctrl');
    var bSim = h('button', 'btn primary', '▶ 模拟季后赛（按实力）');
    bSim.addEventListener('click', function () {
      var rng = SIM.mulberry32((Date.now() ^ 8807) >>> 0);
      var res = SIM.runPlayoffs(state.po.eight, ratingOf, { qf: 3, sf: 3, tp: 3, gf: 5 }, S, rng);
      var m = state.po.matches;
      res.qf.forEach(function (r, i) { m.qf[i] = { a: r.a, b: r.b, win: r.winner, score: r.score, bo: r.bo }; });
      res.sf.forEach(function (r, i) { m.sf[i] = { a: r.a, b: r.b, win: r.winner, score: r.score, bo: r.bo }; });
      m.tp = { a: res.tp.a, b: res.tp.b, win: res.tp.winner, score: res.tp.score, bo: res.tp.bo };
      m.gf = { a: res.gf.a, b: res.gf.b, win: res.gf.winner, score: res.gf.score, bo: res.gf.bo };
      renderPlayoffs();
      maybeFinish();
    });
    ctrl.appendChild(bSim);
    var bClear = h('button', 'btn warn', '清空胜者');
    bClear.addEventListener('click', function () {
      var m = state.po.matches;
      m.qf.forEach(function (q) { q.win = null; }); m.sf.forEach(function (q) { q.win = null; });
      m.tp.win = null; m.gf.win = null; renderPlayoffs();
    });
    ctrl.appendChild(bClear);
    sec.appendChild(ctrl);

    var bracket = h('div', 'bracket');
    var qfCol = h('div', 'bracket-col');
    qfCol.appendChild(h('div', 'bracket-title', '1/4决赛 BO3'));
    state.po.matches.qf.forEach(function (q, i) { qfCol.appendChild(poCard('qf' + i, q)); });
    bracket.appendChild(qfCol);
    var sfCol = h('div', 'bracket-col');
    sfCol.appendChild(h('div', 'bracket-title', '半决赛 BO3'));
    state.po.matches.sf.forEach(function (q, i) { sfCol.appendChild(poCard('sf' + i, q)); });
    bracket.appendChild(sfCol);
    var fCol = h('div', 'bracket-col');
    fCol.appendChild(h('div', 'bracket-title', '总决赛 BO5'));
    fCol.appendChild(poCard('gf', state.po.matches.gf));
    fCol.appendChild(h('div', 'bracket-title', '三四名 BO3'));
    fCol.appendChild(poCard('tp', state.po.matches.tp));
    bracket.appendChild(fCol);
    sec.appendChild(bracket);

    if (state.po.matches.gf.win) {
      var champ = h('div', 'champ-banner');
      champ.appendChild(h('span', 'champ-label', '🏆 冠军'));
      champ.appendChild(logoEl(state.po.matches.gf.win));
      champ.appendChild(h('span', 'champ-name', TEAM_BY_ID[state.po.matches.gf.win].name));
      sec.appendChild(champ);
      var again = h('button', 'btn', '🔄 再来一届（清空重开）');
      again.style.marginTop = '12px';
      again.addEventListener('click', restartAll);
      sec.appendChild(again);
    }
    renderPoOdds(sec);
  }

  function poCard(key, q) {
    var card = h('div', 'match played');
    card.appendChild(h('div', 'm-tag', 'BO' + (q.bo || (key === 'gf' ? 5 : 3))));
    ['a', 'b'].forEach(function (side) {
      var id = q[side];
      var row = h('div', 'mrow team' + (q.win === id ? ' winner' : '') + (q.win && q.win !== id ? ' loser' : '') + (!id ? ' empty' : ''));
      if (!id) { row.textContent = '待定'; row.dataset.empty = '1'; }
      else {
        row.appendChild(logoEl(id));
        row.appendChild(h('span', 'tname', TEAM_BY_ID[id].name));
        if (q.score) row.appendChild(h('span', 'score', String(q.score[side === 'a' ? 0 : 1])));
        row.dataset.id = id;
        if (q.a && q.b) row.classList.add('pick');
      }
      row.dataset.poKey = key; row.dataset.poSide = side;
      card.appendChild(row);
    });
    return card;
  }

  function renderPoOdds(sec) {
    var wrap = h('div', 'panel');
    wrap.style.maxWidth = '720px';
    wrap.style.marginTop = '16px';
    wrap.appendChild(h('div', 'panel-title', '夺冠概率（全赛程蒙特卡洛 ' + (state.fullMC ? state.fullMC.n + ' 次' : '—') + '）'));
    if (!state.fullMC) { sec.appendChild(wrap); return; }
    state.fullMC.champOdds.slice(0, 8).forEach(function (o, i) {
      var row = h('div', 'odds-row');
      row.appendChild(h('span', 'odds-rank', String(i + 1)));
      row.appendChild(logoEl(o.id));
      row.appendChild(h('span', 'nm', TEAM_BY_ID[o.id].name));
      var bar = h('div', 'odds-bar'); var fill = h('div', 'odds-fill');
      fill.style.width = (o.p * 100 * 2.6).toFixed(1) + '%';
      bar.appendChild(fill); row.appendChild(bar);
      row.appendChild(h('span', 'odds-pct', (o.p * 100).toFixed(1) + '%'));
      wrap.appendChild(row);
    });
    sec.appendChild(wrap);
  }

  // ---------------- 总结页 ----------------
  var PLACE_LABEL = {
    1: '🏆 冠军', 2: '🥈 亚军', 3: '🥉 季军 / 殿军', 4: '八强（1/4 决赛出局）',
    5: '第三阶段淘汰', 6: '第二阶段淘汰', 7: '第一阶段淘汰', 0: '仍在争夺'
  };
  var PLACE_ORDER = [1, 2, 3, 4, 5, 6, 7, 0];

  function finalPlacement(id) {
    var po = state.po;
    if (po && po.matches) {
      var m = po.matches;
      if (m.gf && m.gf.win === id) return 1;
      if (m.gf && (m.gf.a === id || m.gf.b === id)) return 2;
      if (m.tp && (m.tp.a === id || m.tp.b === id)) return 3;
      var inQf = m.qf.some(function (q) { return q.a === id || q.b === id; });
      if (inQf) return 4;
    }
    for (var s = 3; s >= 1; s--) {
      var st = state.stages[s];
      if (st.eliminated && st.eliminated.indexOf(id) >= 0) return 8 - s;
    }
    return 0;
  }

  function renderSummary() {
    var sec = document.getElementById('page-sum');
    sec.innerHTML = '';
    sec.classList.add('pickem-stage');
    sec.classList.add('summary-page');
    recomputeRatings();

    var finished = !!(state.po && state.po.matches.gf && state.po.matches.gf.win);

    var head = h('div', 'sum-head');
    head.appendChild(h('h2', '', '📊 本届总结'));
    head.appendChild(h('span', 'sum-status', finished ? '已完赛 · 下面都是最终结果' : '赛事进行中 · 下面是当前进度'));
    sec.appendChild(head);

    // 冠军
    var champ = finished ? state.po.matches.gf.win : null;
    var card1 = h('div', 'sum-card');
    card1.appendChild(h('div', 'sum-title', '🏆 冠军'));
    if (champ) {
      var cw = h('div', 'rp-champ');
      cw.appendChild(logoEl(champ));
      cw.appendChild(h('span', '', TEAM_BY_ID[champ].name));
      card1.appendChild(cw);
    } else card1.appendChild(h('div', 'hint', '尚未决出冠军'));
    sec.appendChild(card1);

    // 关注战队
    var card2 = h('div', 'sum-card');
    card2.appendChild(h('div', 'sum-title', '⭐ 关注的战队'));
    var favIds = Object.keys(state.favorites);
    if (!favIds.length) card2.appendChild(h('div', 'hint', '未关注任何战队（可在首次进入时选择，或右键队标关注）'));
    favIds.forEach(function (id) {
      var j = teamJourney(id);
      var line = TEAM_BY_ID[id].abbr + '：';
      if (j.champ) line += '🏆 冠军';
      else if (j.poRound) line += '季后赛 ' + j.poRound;
      else if (j.stages.length) {
        var last = j.stages[j.stages.length - 1];
        line += '止步' + (last.stage === 1 ? '第一阶段' : last.stage === 2 ? '第二阶段' : '第三阶段') + '（' + last.rec[0] + '胜' + last.rec[1] + '负）';
      } else line += '未出场';
      card2.appendChild(h('div', 'rp-row', line));
    });
    sec.appendChild(card2);

    // 战队分组（双击看战绩）
    var groups = {};
    PLACE_ORDER.forEach(function (k) { groups[k] = []; });
    D.TEAMS.forEach(function (t) { groups[finalPlacement(t.id)].push(t.id); });
    var card3 = h('div', 'sum-card');
    var t3 = h('div', 'sum-title', '战队分组');
    t3.appendChild(h('span', 'sub', '双击任意队标，查看它这届的完整战绩'));
    card3.appendChild(t3);
    PLACE_ORDER.forEach(function (k) {
      if (!groups[k].length) return;
      var g = h('div', 'sum-group');
      g.appendChild(h('div', 'sum-group-title', PLACE_LABEL[k] + '（' + groups[k].length + '）'));
      var row = h('div', 'sum-teams');
      groups[k].forEach(function (id) {
        var c = h('div', 'sum-team' + (k === 1 ? ' champ' : ''));
        c.dataset.id = id;
        c.title = TEAM_BY_ID[id].name + ' · 双击查看战绩';
        c.appendChild(logoEl(id));
        c.appendChild(h('span', '', TEAM_BY_ID[id].abbr));
        row.appendChild(c);
      });
      g.appendChild(row);
      card3.appendChild(g);
    });
    sec.appendChild(card3);

    // 爆冷 + 数据
    var card4 = h('div', 'sum-card');
    card4.appendChild(h('div', 'sum-title', '🎲 小概率事件（爆冷）'));
    var ups = collectUpsets();
    if (!ups.length) card4.appendChild(h('div', 'hint', '暂无爆冷'));
    ups.forEach(function (u) {
      card4.appendChild(h('div', 'rp-upset', TEAM_BY_ID[u.winner].abbr + ' 爆冷击败 ' + TEAM_BY_ID[u.loser].abbr + '（赛前胜率仅 ' + Math.round(u.p * 100) + '%）'));
    });
    card4.appendChild(h('div', 'sum-title', '📊 本届数据'));
    var stt = totalStats();
    card4.appendChild(h('div', 'rp-row', '瑞士轮 ' + stt.swiss + ' 场 · 季后赛 ' + stt.po + ' 场 · 共 ' + stt.maps + ' 图'));
    sec.appendChild(card4);

    // 完赛后 VRS 榜
    var board = D.TEAMS.slice().sort(function (a, b) { return ratingOf(b.id) - ratingOf(a.id); });
    var card5 = h('div', 'sum-card');
    var t5 = h('div', 'sum-title', '📈 完赛后 VRS 榜');
    t5.appendChild(h('span', 'sub', '赛前 VRS + 本届比赛的 Elo 修正'));
    card5.appendChild(t5);
    board.forEach(function (t, i) {
      var cur = Math.round(ratingOf(t.id));
      var d = cur - t.vrs;
      var r = h('div', 'vrs-row');
      r.appendChild(h('span', 'vrs-rank', String(i + 1)));
      r.appendChild(logoEl(t.id));
      r.appendChild(h('span', 'vrs-name', t.name));
      r.appendChild(h('span', 'vrs-val', String(cur)));
      r.appendChild(h('span', 'vrs-delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat'), (d > 0 ? '+' : '') + d));
      card5.appendChild(r);
    });
    sec.appendChild(card5);

    // 操作
    var acts = h('div', 'stage-ctrl');
    var bs = h('button', 'btn', '💾 保存这份结果');
    bs.addEventListener('click', saveBackup);
    acts.appendChild(bs);
    var br = h('button', 'btn primary', '🔄 再来一届');
    br.addEventListener('click', restartAll);
    acts.appendChild(br);
    sec.appendChild(acts);
  }

  // ---------------- 全赛程蒙特卡洛 ----------------
  function simFullMC() {
    var n = D.CONFIG.fullMC;
    var agg = { po: {} };
    D.TEAMS.forEach(function (t) { agg.po[t.id] = { champ: 0 }; });
    var rng = SIM.mulberry32((Date.now() ^ 20261124) >>> 0);
    function pipeline(r) {
      var s1Ids = D.TEAMS.filter(function (t) { return t.stage === 1; }).sort(function (a, b) { return a.rank - b.rank; }).map(function (t) { return t.id; });
      var s1 = SIM.runSwiss(s1Ids, ratingOf, seedRankOf, D.STAGE1_R1, 1, S, r);
      var s2Ids = D.INVITED[2].concat(s1.advances);
      var s2 = SIM.runSwiss(s2Ids, ratingOf, seedRankOf, SIM.vrsPairing(s2Ids, ratingOf), 1, S, r);
      var s3Ids = D.INVITED[3].concat(s2.advances);
      var s3 = SIM.runSwiss(s3Ids, ratingOf, seedRankOf, SIM.vrsPairing(s3Ids, ratingOf), 3, S, r);
      return SIM.runPlayoffs(s3.advances, ratingOf, { qf: 3, sf: 3, tp: 3, gf: 5 }, S, r);
    }
    toast('全赛程蒙特卡洛模拟中 (' + n + ' 次)…');
    setTimeout(function () {
      var t0 = Date.now();
      for (var i = 0; i < n; i++) { var po = pipeline(rng); agg.po[po.champion].champ++; }
      var champOdds = D.TEAMS.map(function (t) { return { id: t.id, p: agg.po[t.id].champ / n }; })
        .sort(function (a, b) { return b.p - a.p; });
      state.fullMC = { n: n, champOdds: champOdds };
      renderCurrent();
      toast('全赛程预测完成 (' + n + ' 次, ' + (Date.now() - t0) + 'ms)');
    }, 30);
  }

  // ---------------- 拖拽 ----------------
  var drag = null, suppressClick = false;
  function findDrop(x, y) {
    var hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    var mr = hit.closest('.mrow.team');
    if (mr && mr.dataset.mode === 'setup') return { type: 'mrow', el: mr };
    var pool = hit.closest('.pool');
    if (pool && pool.dataset.pool) return { type: 'pool', stage: parseInt(pool.dataset.pool, 10) };
    return null;
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.pointerType && e.pointerType !== 'mouse') return;   // 触屏改用点选排阵（见 mobile.js）
    var chip = e.target.closest('.pchip.drag');
    var row = e.target.closest('.mrow.drag');
    if (!chip && !row) return;
    e.preventDefault();
    var payload;
    if (chip && chip.dataset.id) payload = { kind: 'pchip', id: chip.dataset.id, stage: parseInt(chip.dataset.stage, 10), el: chip };
    else if (row && row.dataset.id) payload = { kind: 'mrow', id: row.dataset.id, stage: parseInt(row.dataset.stage, 10), mi: parseInt(row.dataset.mi, 10), side: row.dataset.side, el: row };
    else return;
    drag = { payload: payload, startX: e.clientX, startY: e.clientY, ghost: null, moved: false };
  });

  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.moved && (dx * dx + dy * dy) < 25) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.ghost = drag.payload.el.cloneNode(true);
      drag.ghost.classList.add('chip', 'ghost');
      drag.ghost.style.width = drag.payload.el.offsetWidth + 'px';
      document.body.appendChild(drag.ghost);
      drag.payload.el.classList.add('dragging');
    }
    drag.ghost.style.left = (e.clientX - drag.ghost.offsetWidth / 2) + 'px';
    drag.ghost.style.top = (e.clientY - drag.ghost.offsetHeight / 2) + 'px';
  });

  document.addEventListener('pointerup', function (e) {
    if (!drag) return;
    var payload = drag.payload, moved = drag.moved;
    if (drag.ghost) drag.ghost.remove();
    if (payload.el) payload.el.classList.remove('dragging');
    drag = null;
    if (!moved) return; // 交给 click 处理点选
    suppressClick = true;
    setTimeout(function () { suppressClick = false; }, 120);
    commitDrop(findDrop(e.clientX, e.clientY), payload);
    renderCurrent();
  });
  document.addEventListener('pointercancel', function () {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.payload.el) drag.payload.el.classList.remove('dragging');
    drag = null;
  });

  function getSide(stage, mi, side) {
    var st = state.stages[stage];
    if (!st.r1Arr || !st.r1Arr[mi]) return null;
    return st.r1Arr[mi][side === 'a' ? 0 : 1];
  }
  function setSide(stage, mi, side, id) {
    var st = state.stages[stage];
    if (!st.r1Arr) initR1(stage);
    if (!st.r1Arr[mi]) st.r1Arr[mi] = [null, null];
    st.r1Arr[mi][side === 'a' ? 0 : 1] = id;
    delete st.picks[mi];
    scheduleAdv(stage);
  }

  function commitDrop(target, payload) {
    if (!target) return;
    var stage = payload.stage;
    if (target.type === 'mrow') {
      var mi = parseInt(target.el.dataset.mi, 10);
      var side = target.el.dataset.side;
      var cur = getSide(stage, mi, side);
      var other = getSide(stage, mi, side === 'a' ? 'b' : 'a');
      if (payload.kind === 'pchip') {
        if (other === payload.id) { toast('同一战队不能对阵自己'); return; }
        setSide(stage, mi, side, payload.id);
      } else if (payload.kind === 'mrow') {
        if (payload.mi === mi && payload.side === side) return;
        setSide(stage, mi, side, payload.id);
        if (!(cur === payload.id)) setSide(stage, payload.mi, payload.side, cur);
      }
    } else if (target.type === 'pool' && target.stage === stage && payload.kind === 'mrow') {
      setSide(stage, payload.mi, payload.side, null);
    }
    flashSaved();
  }

  // ---------------- 点击交互 ----------------
  document.addEventListener('click', function (e) {
    if (suppressClick) return;
    var xBtn = e.target.closest('.slot-x');
    if (xBtn) {
      var slot = xBtn.closest('.mrow');
      if (slot) {
        e.stopPropagation();
        setSide(parseInt(slot.dataset.stage, 10), parseInt(slot.dataset.mi, 10), slot.dataset.side, null);
        flashSaved();
        renderCurrent();
      }
      return;
    }
    var row = e.target.closest('.mrow.pick');
    if (!row) return;
    if (row.dataset.poKey) {
      if (!row.dataset.id) return;
      propagateManual(row.dataset.poKey, row.dataset.id);
      renderPlayoffs();
      maybeFinish();
      return;
    }
    var stage = parseInt(row.dataset.stage, 10);
    var mi = parseInt(row.dataset.mi, 10);
    var id = row.dataset.id;
    if (!id) return;
    if (row.dataset.mode === 'setup') {
      var st = state.stages[stage];
      if (st.picks[mi] === id) delete st.picks[mi]; else st.picks[mi] = id;
      scheduleAdv(stage);
      flashSaved();
      renderCurrent();
    } else if (row.dataset.mode === 'next') {
      var stn = state.stages[stage];
      if (stn.nextPicks[mi] === id) delete stn.nextPicks[mi]; else stn.nextPicks[mi] = id;
      scheduleAdv(stage);
      flashSaved();
      renderCurrent();
    } else if (row.dataset.mode === 'result') {
      overrideWinner(stage, parseInt(row.dataset.round, 10), mi, id);
    }
  });

  // ---------------- 右键关注战队 ----------------
  document.addEventListener('contextmenu', function (e) {
    var el = e.target.closest('.mrow.team, .pchip, .bchip, .prob-row');
    if (!el || !el.dataset.id) return;
    e.preventDefault();
    toggleFav(el.dataset.id);
    renderCurrent();
    toast((state.favorites[el.dataset.id] ? '⭐ 已关注 ' : '已取消关注 ') + TEAM_BY_ID[el.dataset.id].name);
  });

  // ---------------- 首次关注选择 ----------------
  var introSel = {};
  function lsGet(k) { try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch (e) {} }

  function showIntro() {
    var mask = document.getElementById('intro-mask');
    var grid = document.getElementById('intro-grid');
    if (!mask || !grid) return;
    grid.innerHTML = '';
    introSel = {};
    D.TEAMS.forEach(function (t) {
      var c = h('div', 'intro-team');
      c.dataset.id = t.id;
      c.appendChild(logoEl(t.id));
      c.appendChild(h('span', '', t.abbr + ' · ' + t.name));
      grid.appendChild(c);
    });
    mask.classList.add('show');
  }
  function closeIntro() { var m = document.getElementById('intro-mask'); if (m) m.classList.remove('show'); }
  function applyIntro() {
    state.favorites = {};
    Object.keys(introSel).forEach(function (id) { state.favorites[id] = true; });
    lsSet('major_favs', JSON.stringify(Object.keys(state.favorites)));
    lsSet('major_favs_done', '1');
    closeIntro();
    renderCurrent();
  }
  function initIntro() {
    document.getElementById('intro-grid').addEventListener('click', function (e) {
      var c = e.target.closest('.intro-team');
      if (!c) return;
      var id = c.dataset.id;
      if (introSel[id]) delete introSel[id]; else introSel[id] = true;
      c.classList.toggle('sel', !!introSel[id]);
    });
    document.getElementById('intro-start').addEventListener('click', applyIntro);
    document.getElementById('intro-skip').addEventListener('click', function () {
      lsSet('major_favs_done', '1'); lsSet('major_favs', '[]');
      closeIntro(); renderCurrent();
    });
  }

  // ---------------- 双击查看战队战绩 ----------------
  function teamJourney(id) {
    var j = { id: id, stages: [], champ: false, poRound: null };
    for (var s = 1; s <= 3; s++) {
      var st = state.stages[s];
      if (!st.records || !st.records[id]) continue;
      var rec = st.records[id];
      var tag = '';
      if (st.advances && st.advances.indexOf(id) >= 0) tag = 'adv';
      if (st.eliminated && st.eliminated.indexOf(id) >= 0) tag = 'elim';
      j.stages.push({ stage: s, rec: rec, tag: tag });
    }
    if (state.po && state.po.eight.indexOf(id) >= 0) {
      var m = state.po.matches;
      if (m.gf && m.gf.win === id) { j.champ = true; j.poRound = '冠军'; }
      else if (m.tp && (m.tp.a === id || m.tp.b === id)) j.poRound = '三四名决赛';
      else if ((m.sf[0].a === id || m.sf[0].b === id || m.sf[1].a === id || m.sf[1].b === id)) j.poRound = '半决赛';
      else j.poRound = '1/4决赛';
    }
    return j;
  }
  function openTeamReport(id) {
    recomputeRatings();
    var j = teamJourney(id);
    var t = TEAM_BY_ID[id];
    var cur = Math.round(ratingOf(id));
    var diff = cur - t.vrs;
    var diffStr = diff === 0 ? '（持平）' : (diff > 0 ? '（+' + diff + '）' : '（' + diff + '）');
    document.getElementById('team-title').textContent = t.abbr + ' · ' + t.name;
    document.getElementById('team-sub').textContent = 'VRS ' + t.vrs + ' → ' + cur + diffStr + ' · 全球 #' + t.rank + (j.champ ? ' · 🏆 冠军' : (j.poRound ? ' · 季后赛：' + j.poRound : ''));
    var body = document.getElementById('team-body');
    body.innerHTML = '';
    var wrap = h('div', 'team-journey');
    if (!j.stages.length) wrap.appendChild(h('div', 'hint', '这支队还没有比赛记录'));
    j.stages.forEach(function (s) {
      var row = h('div', 'tj-row');
      row.appendChild(h('span', 'tj-stage', s.stage === 1 ? '第一阶段' : s.stage === 2 ? '第二阶段' : '第三阶段'));
      row.appendChild(h('span', 'tj-rec', s.rec[0] + ' 胜 / ' + s.rec[1] + ' 负'));
      if (s.tag === 'adv') row.appendChild(h('span', 'tj-tag adv', '晋级'));
      else if (s.tag === 'elim') row.appendChild(h('span', 'tj-tag elim', '淘汰'));
      wrap.appendChild(row);
    });
    if (j.poRound) {
      var pr = h('div', 'tj-row');
      pr.appendChild(h('span', 'tj-stage', '季后赛'));
      pr.appendChild(h('span', 'tj-tag ' + (j.champ ? 'champ' : 'adv'), j.poRound));
      wrap.appendChild(pr);
    }
    body.appendChild(wrap);
    document.getElementById('team-modal').classList.add('show');
  }
  function initTeamReport() {
    document.getElementById('team-close').addEventListener('click', function () {
      document.getElementById('team-modal').classList.remove('show');
    });
    document.addEventListener('dblclick', function (e) {
      var el = e.target.closest('.pchip, .bchip, .prob-row, .zone-team, .intro-team, .sum-team');
      if (!el || !el.dataset.id) return;
      if (isPlaceholder(el.dataset.id)) return;
      openTeamReport(el.dataset.id);
    });
  }

  // ---------------- 完赛汇报 ----------------
  function collectUpsets() {
    recomputeRatings();
    var list = (state.upsetList || []).filter(function (u) { return u.p < 0.5; });
    list.sort(function (x, y) { return x.p - y.p; });
    return list.slice(0, 5);
  }
  function totalStats() {
    var swiss = 0, po = 0, maps = 0;
    [1, 2, 3].forEach(function (s) {
      var st = state.stages[s];
      if (!st.rounds) return;
      st.rounds.forEach(function (r) { r.forEach(function (m) { swiss++; if (m.score) maps += m.score[0] + m.score[1]; }); });
    });
    if (state.po) {
      var m = state.po.matches;
      ['qf', 'sf'].forEach(function (k) {
        m[k].forEach(function (q) { if (q.win) { po++; if (q.score) maps += q.score[0] + q.score[1]; } });
      });
      if (m.tp && m.tp.win) { po++; if (m.tp.score) maps += m.tp.score[0] + m.tp.score[1]; }
      if (m.gf && m.gf.win) { po++; if (m.gf.score) maps += m.gf.score[0] + m.gf.score[1]; }
    }
    return { swiss: swiss, po: po, maps: maps };
  }
  function openReport() {
    var champ = state.po && state.po.matches.gf && state.po.matches.gf.win;
    var body = document.getElementById('report-body');
    body.innerHTML = '';
    var box = h('div', 'report-body');

    var ch = h('div', 'rp-champ');
    if (champ) { ch.appendChild(logoEl(champ)); ch.appendChild(h('span', '', TEAM_BY_ID[champ].name + ' 夺冠')); }
    else ch.appendChild(h('span', 'hint', '尚未决出冠军'));
    box.appendChild(ch);

    var sec = h('div', '');
    sec.appendChild(h('div', 'rp-sec-title', '⭐ 关注的战队'));
    var favIds = Object.keys(state.favorites);
    if (!favIds.length) sec.appendChild(h('div', 'hint', '未关注任何战队'));
    favIds.forEach(function (id) {
      var j = teamJourney(id);
      var line = TEAM_BY_ID[id].abbr + '：';
      if (j.champ) line += '🏆 冠军';
      else if (j.poRound) line += '季后赛 ' + j.poRound;
      else if (j.stages.length) {
        var last = j.stages[j.stages.length - 1];
        line += '止步' + (last.stage === 1 ? '第一阶段' : last.stage === 2 ? '第二阶段' : '第三阶段') + '（' + last.rec[0] + '胜' + last.rec[1] + '负）';
      } else line += '未出场';
      sec.appendChild(h('div', 'rp-row', line));
    });
    box.appendChild(sec);

    var sec2 = h('div', '');
    sec2.appendChild(h('div', 'rp-sec-title', '🎲 小概率事件（爆冷）'));
    var ups = collectUpsets();
    if (!ups.length) sec2.appendChild(h('div', 'hint', '无爆冷'));
    ups.forEach(function (u) {
      sec2.appendChild(h('div', 'rp-upset', TEAM_BY_ID[u.winner].abbr + ' 爆冷击败 ' + TEAM_BY_ID[u.loser].abbr + '（赛前胜率仅 ' + Math.round(u.p * 100) + '%）'));
    });
    box.appendChild(sec2);

    var st = totalStats();
    var sec3 = h('div', '');
    sec3.appendChild(h('div', 'rp-sec-title', '📊 本届数据'));
    sec3.appendChild(h('div', 'rp-row', '瑞士轮 ' + st.swiss + ' 场 · 季后赛 ' + st.po + ' 场 · 共 ' + st.maps + ' 图'));
    box.appendChild(sec3);

    body.appendChild(box);
    document.getElementById('report-mask').classList.add('show');
  }
  function maybeFinish() {
    if (state.po && state.po.matches.gf && state.po.matches.gf.win && !state.reported) {
      state.reported = true;
      state.page = 'sum';
      renderCurrent();
      toast('🏆 本届 Major 完赛 · 这是总结页');
    }
  }
  function initReport() {
    document.getElementById('report-close').addEventListener('click', function () {
      document.getElementById('report-mask').classList.remove('show');
    });
    document.getElementById('report-save').addEventListener('click', function () {
      saveBackup();
      document.getElementById('report-mask').classList.remove('show');
    });
    document.getElementById('report-restart').addEventListener('click', restartAll);
  }

  // 清空全部结果，开新的一届（保留关注）
  function restartAll() {
    state.stages = { 1: newStage(1), 2: newStage(2), 3: newStage(3) };
    state.po = null;
    state.reported = false;
    state.page = 's1';
    state.ratings = {};
    state.upsetList = [];
    var m = document.getElementById('report-mask');
    if (m) m.classList.remove('show');
    recomputeRatings();
    renderCurrent();
    toast('已重新开始 · 新的一届');
  }

  // ---------------- 结果备份（最多 3 个，只读） ----------------
  function readBackups() {
    var s = lsGet('major_backups');
    if (!s) return [];
    try { var a = JSON.parse(s); return a || []; } catch (e) { return []; }
  }
  function writeBackups(a) { lsSet('major_backups', JSON.stringify(a)); }
  function makeSnapshot() {
    var snap = { t: Date.now(), fav: Object.keys(state.favorites) };
    if (state.po) {
      var m = state.po.matches;
      snap.champ = m.gf ? m.gf.win : null;
      snap.po = {
        qf: m.qf.map(function (q) { return { a: q.a, b: q.b, win: q.win }; }),
        sf: m.sf.map(function (q) { return { a: q.a, b: q.b, win: q.win }; }),
        tp: m.tp ? { a: m.tp.a, b: m.tp.b, win: m.tp.win } : null,
        gf: m.gf ? { a: m.gf.a, b: m.gf.b, win: m.gf.win } : null
      };
    }
    snap.stages = [1, 2, 3].map(function (s) {
      var st = state.stages[s];
      return {
        advances: st.advances ? st.advances.slice() : null,
        eliminated: st.eliminated ? st.eliminated.slice() : null,
        records: st.records ? JSON.parse(JSON.stringify(st.records)) : null
      };
    });
    return snap;
  }
  function saveBackup() {
    var list = readBackups();
    list.push(makeSnapshot());
    if (list.length > 3) list = list.slice(list.length - 3);
    writeBackups(list);
    renderBackups();
    toast('已保存备份（' + list.length + '/3）');
  }
  function fmtTime(t) {
    var d = new Date(t);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function renderBackups() {
    var box = document.getElementById('backup-list');
    if (!box) return;
    var list = readBackups();
    box.innerHTML = '';
    if (!list.length) { box.appendChild(h('div', 'hint', '暂无备份')); return; }
    list.forEach(function (snap, i) {
      var c = h('div', 'backup-card');
      c.appendChild(h('div', 'bk-title', '备份 ' + (i + 1) + ' · ' + fmtTime(snap.t)));
      c.appendChild(h('div', '', snap.champ ? ('🏆 冠军 ' + (TEAM_BY_ID[snap.champ] ? TEAM_BY_ID[snap.champ].name : snap.champ)) : '未完成到冠军'));
      c.appendChild(h('div', 'bk-dim', '关注 ' + (snap.fav.length || 0) + ' 队 · 三阶段已存档'));
      box.appendChild(c);
    });
  }
  function initBackups() {
    document.querySelectorAll('[data-act="backup"]').forEach(function (b) { b.addEventListener('click', saveBackup); });
  }

  // ---------------- 页面切换 & 按钮 ----------------
  function initStepper() {
    document.querySelectorAll('.step').forEach(function (s) {
      s.addEventListener('click', function () {
        if (/^s[123]$/.test(s.dataset.page) && stageLocked(parseInt(s.dataset.page.slice(1), 10))) {
          toast('该阶段已完成，且下一阶段已开始，已锁定');
          return;
        }
        state.page = s.dataset.page;
        renderCurrent();
      });
    });
    document.getElementById('modal-next').addEventListener('click', function () {
      var stage = state.pendingComplete;
      if (!stage) return;
      closeComplete();
      if (stage < 3) {
        var ns = state.stages[stage + 1];
        if (poolComplete(stage + 1) && !ns.r1Arr) ns.r1Arr = SIM.vrsPairing(realPoolIds(stage + 1), ratingOf);
        state.page = 's' + (stage + 1);
      } else {
        state.page = 'po';
      }
      renderCurrent();
    });
    document.getElementById('modal-resim').addEventListener('click', function () {
      var stage = state.pendingComplete;
      if (!stage) return;
      closeComplete();
      simulateStage(stage);
    });
    document.getElementById('modal-close').addEventListener('click', closeComplete);
    document.querySelectorAll('[data-act="fullmc"]').forEach(function (b) {
      b.addEventListener('click', simFullMC);
    });
  }

  function init() {
    initStepper();
    initIntro();
    initTeamReport();
    initReport();
    initBackups();
    if (!lsGet('major_favs_done')) {
      showIntro();
    } else {
      var favs = lsGet('major_favs');
      if (favs) {
        try {
          var arr = JSON.parse(favs);
          if (arr) arr.forEach(function (id) { state.favorites[id] = true; });
        } catch (e) {}
      }
    }
    renderCurrent();
    renderBackups();
    setTimeout(function () { simFullMC(); }, 300);
  }

  window.__MAJOR_UI__ = {
    state: state, simulateStage: simulateStage, simulateRound: simulateRound, overrideWinner: overrideWinner,
    computeAdv: computeAdv, renderCurrent: renderCurrent, resetStage: resetStage,
    buildPlayoffs: buildPlayoffs, getSide: getSide, setSide: setSide, simFullMC: simFullMC,
    toggleFav: toggleFav, flashSaved: flashSaved, nextPairs: nextPairs, stageZones: stageZones,
    recomputeRatings: recomputeRatings, ratingOf: ratingOf, restartAll: restartAll, teamJourney: teamJourney,
    stageLocked: stageLocked, finalPlacement: finalPlacement, renderSummary: renderSummary
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
