/* ============================================================
 * PGL Major Singapore 2026 — 模拟引擎 (浏览器 + Node 通用)
 * 模型:
 *  - 单图胜率 p = 1 / (1 + 10^(-(rA-rB)/S)), r = VRS积分, S 由首轮盘口拟合≈620
 *  - BO3 胜率 = p^2(3-2p), BO5 用二项分布
 *  - 瑞士轮配对: 首轮按官方对阵/VRS蛇形配对; 之后同战绩池内按种子
 *    高低搭配配对, 避免重赛; 布赫霍尔茨分 = 对手胜场之和
 *  - 季后赛种子: 按战绩(3-0>3-1>3-2) → 布赫霍尔茨 → VRS 排序
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SIM = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEBUG = (typeof globalThis !== 'undefined' && globalThis.__SIM_DEBUG__) || null;
  function dbg() { if (DEBUG) console.log.apply(console, ['[sim]'].concat([].slice.call(arguments))); }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }

  // 单图胜率
  function pWin(rA, rB, S) {
    return 1 / (1 + Math.pow(10, -(rA - rB) / S));
  }

  // BO3/BO5 系列赛胜率
  function pSeries(p, n) {
    var need = (n + 1) / 2, sum = 0;
    for (var k = need; k <= n; k++) {
      sum += binom(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    }
    return sum;
  }

  // 模拟一场比赛: 逐图模拟产生比分, 胜者由比分决定 (保证一致)
  // 返回 { a, b, winner, loser, score:[a胜图数,b胜图数], bo }
  function playMatch(a, b, ratingOf, bestOf, S, rng) {
    var ra = ratingOf(a), rb = ratingOf(b);
    var p = pWin(ra, rb, S);
    var need = (bestOf + 1) / 2;
    var wa = 0, wb = 0;
    while (wa < need && wb < need) { if (rng() < p) wa++; else wb++; }
    var winner = wa > wb ? a : b;
    var loser = winner === a ? b : a;
    return { a: a, b: b, winner: winner, loser: loser, score: [wa, wb], bo: bestOf };
  }

  // 同战绩池配对: 种子高低搭配, 避免重赛
  function pairPool(ids, seedRank, played) {
    var pool = ids.slice().sort(function (x, y) { return seedRank(x) - seedRank(y); });
    var n = pool.length, pairs = [], used = {};
    for (var i = 0; i < n; i++) {
      if (used[pool[i]]) continue;
      var chosen = -1;
      // 优先与"另一半"配对 (1v5,2v6... 8队池)
      for (var j = Math.floor(n / 2); j < n; j++) {
        if (j === i || used[pool[j]]) continue;
        if (!played(pool[i], pool[j])) { chosen = j; break; }
      }
      if (chosen === -1) {
        for (var k = 0; k < n; k++) {
          if (k === i || used[pool[k]]) continue;
          if (!played(pool[i], pool[k])) { chosen = k; break; }
        }
      }
      if (chosen === -1) { // 极端情况: 被迫重赛
        for (var m = 0; m < n; m++) { if (m !== i && !used[pool[m]]) { chosen = m; break; } }
      }
      used[pool[i]] = true; used[pool[chosen]] = true;
      pairs.push([pool[i], pool[chosen]]);
    }
    return pairs;
  }

  // VRS 蛇形配对: 1v16, 2v15 ...
  function vrsPairing(ids, ratingOf) {
    var sorted = ids.slice().sort(function (a, b) { return ratingOf(b) - ratingOf(a); });
    var pairs = [];
    for (var i = 0; i < sorted.length / 2; i++) {
      pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
    }
    return pairs;
  }

  /**
   * 运行一个16队瑞士轮阶段
   * @param ids       16支队伍id(首元素种子最高)
   * @param ratingOf  id -> rating
   * @param seedRank  id -> 种子序号(越小越前)
   * @param r1Pairs   首轮对阵(可为null, 则用蛇形配对)
   * @param bestOf    1 或 3 (或函数(rec)->bo)
   * @param rng       随机数发生器
   * @returns { rounds, records, buchholz, advances, eliminated, order }
   */
  function runSwiss(ids, ratingOf, seedRank, r1Pairs, bestOf, S, rng) {
    var rec = {}, opp = {}, bu = {}, done = {};
    ids.forEach(function (id) { rec[id] = [0, 0]; opp[id] = {}; bu[id] = 0; done[id] = false; });
    function played(a, b) { return !!opp[a][b]; }
    var rounds = [], round = 0;

    while (round < 5) {
      round++;
      var active = ids.filter(function (id) { return !done[id]; });
      var pairs;
      if (round === 1 && r1Pairs) {
        pairs = r1Pairs.slice();
      } else {
        var groups = {};
        active.forEach(function (id) {
          var k = rec[id][0] + '-' + rec[id][1];
          (groups[k] = groups[k] || []).push(id);
        });
        pairs = [];
        for (var g in groups) {
          pairs = pairs.concat(pairPool(groups[g], seedRank, played));
        }
      }
      var res = pairs.map(function (pair) {
        var bo = typeof bestOf === 'function' ? bestOf(rec) : bestOf;
        var m = playMatch(pair[0], pair[1], ratingOf, bo, S, rng);
        rec[m.winner][0]++; rec[m.loser][1]++;
        opp[m.a][m.b] = true; opp[m.b][m.a] = true;
        m.round = round;
        dbg('R' + round + ' match: ' + m.a + ' ' + m.score[0] + '-' + m.score[1] + ' ' + m.b + ' -> ' + m.winner);
        return m;
      });
      rounds.push(res);
      ids.forEach(function (id) {
        if (rec[id][0] === 3 || rec[id][1] === 3) done[id] = true;
      });
      dbg('R' + round + ' rec: ' + JSON.stringify(rec));
    }

    ids.forEach(function (id) {
      var s = 0;
      for (var o in opp[id]) s += rec[o][0];
      bu[id] = s;
    });

    var advances = ids.filter(function (id) { return rec[id][0] === 3; });
    var eliminated = ids.filter(function (id) { return rec[id][1] === 3; });
    function orderCmp(a, b) {
      // 3-0 优先于 3-1 优先于 3-2 (晋级侧); 淘汰侧 2-3/1-3/0-3 同理按胜场排
      var wa = rec[a][0], wb = rec[b][0];
      if (wa !== wb) return wb - wa;
      if (bu[a] !== bu[b]) return bu[b] - bu[a];
      return seedRank(a) - seedRank(b);
    }
    advances.sort(orderCmp);
    eliminated.sort(function (a, b) {
      var wa = rec[a][0], wb = rec[b][0];
      if (wa !== wb) return wb - wa;
      if (bu[a] !== bu[b]) return bu[b] - bu[a];
      return seedRank(a) - seedRank(b);
    });
    return {
      rounds: rounds,
      records: rec,
      buchholz: bu,
      advances: advances,     // 已按季后赛种子顺序
      eliminated: eliminated,
      order: advances.concat(eliminated)
    };
  }

  /**
   * 8队单败季后赛
   * @param eight 已按种子顺序的8支队伍id
   */
  function runPlayoffs(eight, ratingOf, bo, S, rng) {
    var qf = [
      [eight[0], eight[7]], [eight[3], eight[4]],
      [eight[1], eight[6]], [eight[2], eight[5]]
    ].map(function (p) { return playMatch(p[0], p[1], ratingOf, bo.qf, S, rng); });

    var sf = [
      playMatch(qf[0].winner, qf[1].winner, ratingOf, bo.sf, S, rng),
      playMatch(qf[2].winner, qf[3].winner, ratingOf, bo.sf, S, rng)
    ];
    var tp = playMatch(sf[0].loser, sf[1].loser, ratingOf, bo.tp, S, rng);
    var gf = playMatch(sf[0].winner, sf[1].winner, ratingOf, bo.gf, S, rng);
    return {
      qf: qf, sf: sf, tp: tp, gf: gf,
      champion: gf.winner,
      runnerUp: gf.loser,
      third: tp.winner,
      fourth: tp.loser
    };
  }

  /**
   * 完整赛程模拟: 第一阶段 → 第二阶段 → 第三阶段 → 季后赛
   * @param D    MAJOR_DATA
   * @param rng  随机数
   * @param overrides 可选: 队伍rating覆盖 {id: rating}
   */
  function runMajor(D, rng, overrides) {
    var S = D.CONFIG.S;
    var ratingOf = function (id) {
      return (overrides && overrides[id]) || D.TEAM_BY_ID[id].vrs;
    };
    var seedRankOf = function (id) {
      return D.TEAM_BY_ID[id].rank; // 全球VRS名次
    };

    var s1Ids = D.TEAMS.filter(function (t) { return t.stage === 1; })
      .sort(function (a, b) { return a.rank - b.rank; })
      .map(function (t) { return t.id; });

    var s1 = runSwiss(s1Ids, ratingOf, seedRankOf, D.STAGE1_R1, 1, S, rng);

    var s2Ids = D.INVITED[2].concat(s1.advances);
    var s2 = runSwiss(s2Ids, ratingOf, seedRankOf,
      vrsPairing(s2Ids, ratingOf), 1, S, rng);

    var s3Ids = D.INVITED[3].concat(s2.advances);
    var s3 = runSwiss(s3Ids, ratingOf, seedRankOf,
      vrsPairing(s3Ids, ratingOf), 3, S, rng);

    var playoffs = runPlayoffs(s3.advances, ratingOf,
      { qf: D.PLAYOFFS.qf, sf: D.PLAYOFFS.sf, tp: D.PLAYOFFS.tp, gf: D.PLAYOFFS.gf },
      S, rng);

    return { s1: s1, s2: s2, s3: s3, playoffs: playoffs };
  }

  return {
    mulberry32: mulberry32,
    pWin: pWin,
    pSeries: pSeries,
    playMatch: playMatch,
    pairPool: pairPool,
    vrsPairing: vrsPairing,
    runSwiss: runSwiss,
    runPlayoffs: runPlayoffs,
    runMajor: runMajor
  };
}));
