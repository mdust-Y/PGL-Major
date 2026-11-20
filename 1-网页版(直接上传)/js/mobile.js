/* ============================================================
 * 触屏（微信）适配：点选排阵
 * 桌面端仍然用拖拽；手机上没有可靠的拖拽，改成：
 *   1) 点战队池里的队伍 → 高亮选中
 *   2) 点任意对阵槽位 → 放入（该队若在别处会自动挪过来）
 *   3) 槽位右侧的 × 可以把队伍移回池子
 * 依赖 ui.js 暴露的 window.__MAJOR_UI__
 * ============================================================ */
(function () {
  'use strict';

  var M = window.__MAJOR_UI__;
  if (!M) return;

  var coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
               (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  if (!coarse) return;   // 桌面端不动，保留鼠标拖拽

  var sel = null;        // { id, stage, el }
  var hint = document.createElement('div');
  hint.className = 'mhint';
  document.body.appendChild(hint);

  function setHint(text) {
    hint.textContent = text || '';
    hint.classList.toggle('show', !!text);
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._mt);
    t._mt = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function teamName(id) {
    var d = window.MAJOR_DATA;
    return d && d.TEAM_BY_ID && d.TEAM_BY_ID[id] ? d.TEAM_BY_ID[id].name : id;
  }

  function clearSel() {
    if (sel && sel.el) sel.el.classList.remove('sel');
    var old = document.querySelector('.pchip.sel');
    if (old) old.classList.remove('sel');
    sel = null;
    setHint('');
  }

  function place(stage, mi, side, id) {
    var st = M.state.stages[stage];
    var arr = st.r1Arr || [];
    var other = side === 'a' ? 'b' : 'a';

    if (M.getSide(stage, mi, other) === id) {
      toast('同一支队伍不能对阵自己');
      return false;
    }
    // 该队若已在别的槽位，先挪走（触屏没有拖拽的隐式搬移）
    for (var i = 0; i < arr.length; i++) {
      if (!arr[i]) continue;
      if (arr[i][0] === id && !(i === mi && side === 'a')) M.setSide(stage, i, 'a', null);
      if (arr[i][1] === id && !(i === mi && side === 'b')) M.setSide(stage, i, 'b', null);
    }
    M.setSide(stage, mi, side, id);
    return true;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('.slot-x')) return;   // 交给 ui.js 处理

    var chip = t.closest('.pchip.drag');
    if (chip) {
      e.stopPropagation();
      var id = chip.dataset.id;
      var stage = parseInt(chip.dataset.stage, 10);
      if (sel && sel.id === id) { clearSel(); return; }
      clearSel();
      sel = { id: id, stage: stage, el: chip };
      chip.classList.add('sel');
      setHint('已选 ' + teamName(id) + ' · 点一个对阵槽放入（再点一次取消）');
      return;
    }

    var row = t.closest('.mrow.team');
    if (row && sel && row.dataset.mode === 'setup') {
      var rs = parseInt(row.dataset.stage, 10);
      if (rs !== sel.stage) { toast('请先切换到同一阶段的页面'); return; }
      e.stopPropagation();
      e.preventDefault();
      var mi = parseInt(row.dataset.mi, 10);
      var side = row.dataset.side;
      var who = sel.id;
      if (place(rs, mi, side, who)) {
        clearSel();
        M.renderCurrent();
        toast('已放入 ' + teamName(who));
      }
      return;
    }

    if (sel) clearSel();
  }, true);

  // 留一个调试入口
  window.__MAJOR_MOBILE__ = { place: place, isCoarse: coarse };
})();
