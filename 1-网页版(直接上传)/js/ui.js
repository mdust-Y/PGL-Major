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

  function ratingOf(id) { return TEAM_BY_ID[id].vrs; }
  function seedRankOf(id) { return TEAM_BY_ID[id].rank; }
  function isPlaceholder(id) { return id.indexOf(PLACEHOLDER_PREFIX) === 0; }
  function placeholders(stage) {
    var a = []; for (var i = 0; i < 8; i++) a.push(PLACEHOLDER_PREFIX + stage + '-' + i); return a;
  }

  function newStage(stage) {
    var st = {
      picks: {}, rounds: null, records: null, advances: null, eliminated: null, adv: {},
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
    favorites: {}   // 右键关注的高亮战队
  };

  // 瑞士轮战绩分组列顺序 (按进入该组时的战绩)
  var GROUP_ORDER = ['0-0', '1-0', '0-1', '2-0', '1-1', '0-2', '2-1', '1-2', '2-2'];

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
  }

  function clearResults(stage) {
    var st = state.stages[stage];
    st.rounds = null; st.records = null; st.advances = null; st.eliminated = null; st.picks = {}; st.adv = {};
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
    st.r1Arr = stage === 1 ? D.STAGE1_R1.map(function (p) { return p.slice(); }) : null;
    for (var s = stage + 1; s <= 3; s++) {
      clearResults(s);
      state.stages[s].r1Arr = null;
      state.stages[s].pool.adv = placeholders(s);
    }
    state.po = null;
    computeAdv(stage);
  }

  function stageFixed(stage) {
    var st = state.stages[stage];
    if (st.rounds) return fixedFromRounds(st.rounds);
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
    var st = state.stages[stage];
    var ids = realPoolIds(stage);
    if (ids.length !== 16) return;
    if (st.rounds && st.rounds.length === 5) {
      // 已完赛: 确定性
      ids.forEach(function (id) { st.adv[id] = (st.advances && st.advances.indexOf(id) >= 0) ? 1 : 0; });
      return;
    }
    var r1 = initR1(stage);
    var fixed = st.rounds ? fixedFromRounds(st.rounds)
      : [{ pairs: r1, winners: r1.map(function (p, mi) { return st.picks[mi] || null; }) }];
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
    ['overview', 's1', 's2', 's3', 'po'].forEach(function (p) {
      document.getElementById('page-' + p).classList.toggle('active', state.page === p);
    });
    var steps = document.querySelectorAll('.step');
    steps.forEach(function (s) { s.classList.toggle('active', s.dataset.page === state.page); });
    if (state.page === 'overview') renderOverview();
    else if (state.page === 'po') renderPlayoffs();
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

  function renderStagePage(stage) {
    var sec = document.getElementById('page-s' + stage);
    sec.innerHTML = '';
    var st = state.stages[stage];
    var cfg = D.STAGES[stage];
    var setup = !st.rounds;
    var complete = poolComplete(stage);
    var ids = realPoolIds(stage);
    var r1 = setup ? initR1(stage) : st.rounds[0];
    // 首次进入设定模式时, 惰性计算一次实时晋级概率
    if (setup && complete && !st.advInit) { st.advInit = true; scheduleAdv(stage); }

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
    ctrl.appendChild(h('span', 'hint', (setup ? '拖拽战队到 0-0 组对阵 → 点选每场胜者 → 「模拟下一轮」逐步推进' : '结果模式：点击任意场次改判，自动重算后续 · 右键战队 = 标记关注') + (Object.keys(state.favorites).length ? ' · ⭐关注 ' + Object.keys(state.favorites).length + ' 队' : '')));
    sec.appendChild(ctrl);

    var grid = h('div', 'stage-grid');

    // 左侧梯形对阵: 按战绩分组列 (0-0 / 1-0 / 0-1 / ...)
    var ladderWrap = h('div', 'ladder-wrap');
    var ladder = h('div', 'ladder');
    if (!complete) {
      var c = h('div', 'round-col');
      c.appendChild(h('div', 'hint', '请先完成上一阶段模拟，战队池才会补全'));
      ladder.appendChild(c);
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
      GROUP_ORDER.forEach(function (g) {
        var col = h('div', 'round-col');
        col.appendChild(h('div', 'round-title', g));
        var items = byGroup[g] || [];
        if (items.length === 0) {
          col.appendChild(h('div', 'round-pending', setup ? '待模拟' : ''));
        } else {
          items.forEach(function (it) {
            if (it.setup) col.appendChild(setupMatchCard(stage, it.mi, it.pair));
            else col.appendChild(resultMatchCard(stage, it.round, it.mi, it.m));
          });
        }
        ladder.appendChild(col);
      });
    }
    ladderWrap.appendChild(ladder);
    grid.appendChild(ladderWrap);

    // 右侧栏
    var sidebar = h('div', 'sidebar');
    sidebar.appendChild(probPanel(stage));
    sidebar.appendChild(poolPanel(stage));
    grid.appendChild(sidebar);
    sec.appendChild(grid);

    // 晋级/淘汰区
    if (!setup && st.advances) {
      var buckets = h('div', 'buckets');
      buckets.appendChild(bucketEl(stage, true, st.advances));
      buckets.appendChild(bucketEl(stage, false, st.eliminated));
      sec.appendChild(buckets);
    }
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
        empty: !id, draggable: !!id, clickable: !!id, clearable: !!id, picked: st.picks[mi] === id,
        prob: (id && other) ? SIM.pWin(ratingOf(id), ratingOf(other), S) : undefined,
        stage: stage, mi: mi, side: side, mode: 'setup', round: 0
      });
      card.appendChild(row);
    });
    return card;
  }

  function resultMatchCard(stage, r, mi, m) {
    var card = h('div', 'match played');
    card.appendChild(h('div', 'm-tag', 'BO' + m.bo + (m.manual ? ' · 🔒' : '')));
    ['a', 'b'].forEach(function (side) {
      var id = m[side];
      var rec = state.stages[stage].records[id];
      card.appendChild(mrow(id, {
        winner: m.winner === id, loser: m.winner && m.winner !== id,
        score: side === 'a' ? m.score[0] : m.score[1],
        record: rec ? rec[0] + '-' + rec[1] : undefined,
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
      e.appendChild(h('span', 'tname', TEAM_BY_ID[id].name));
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
    ids.forEach(function (id) {
      if (isPlaceholder(id)) {
        var ph = h('div', 'pchip placeholder', '待定');
        ph.title = '上一阶段模拟完成后自动填入';
        pool.appendChild(ph);
      } else if (setup && placed[id]) {
        // 已放入对阵槽
      } else {
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
    return p;
  }

  function probPanel(stage) {
    var p = h('div', 'panel');
    p.appendChild(h('div', 'panel-title', '晋级概率（实时）'));
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

  // ---------------- 页面切换 & 按钮 ----------------
  function initStepper() {
    document.querySelectorAll('.step').forEach(function (s) {
      s.addEventListener('click', function () { state.page = s.dataset.page; renderCurrent(); });
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
    renderCurrent();
    setTimeout(function () { simFullMC(); }, 300);
  }

  window.__MAJOR_UI__ = {
    state: state, simulateStage: simulateStage, simulateRound: simulateRound, overrideWinner: overrideWinner,
    computeAdv: computeAdv, renderCurrent: renderCurrent, resetStage: resetStage,
    buildPlayoffs: buildPlayoffs, getSide: getSide, setSide: setSide, simFullMC: simFullMC,
    toggleFav: toggleFav
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
