(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.DueCompletion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ── Canvas 是否已收到繳交（單一真相來源，供 dashboard.js 委派）──
  function isSubmitted(assignment) {
    return !!(assignment && assignment.submission && (
      assignment.submission.submitted_at ||
      assignment.submission.workflow_state === 'submitted' ||
      assignment.submission.workflow_state === 'graded'
    ));
  }

  // ── 手動完成 map 是否標記該 id（id 一律 String 正規化）──
  function isManualDone(manualDoneMap, id) {
    return !!(manualDoneMap || {})[String(id)];
  }

  // ── 手動「標回未完成」map 是否標記該 id（鏡像 isManualDone，只對 Canvas 已繳者有意義）──
  function isManualUndone(manualUndoneMap, id) {
    return !!(manualUndoneMap || {})[String(id)];
  }

  // ── 綜合完成判斷：（Canvas 已繳 且 未標回未完成）「或」手動完成 ──
  //    manualUndoneMap 可省略（省略＝舊行為）；髒資料兩 map 同時有 → manualDone 勝出（仍算完成）
  function isDone(assignment, manualDoneMap, manualUndoneMap) {
    const id = assignment && assignment.id;
    return (isSubmitted(assignment) && !isManualUndone(manualUndoneMap, id))
      || isManualDone(manualDoneMap, id);
  }

  // ── 切換手動完成，回傳「新的」map（immutable，不 mutate 輸入）──
  //    nextState 省略時翻轉；true → 設 true；false → 刪除該 key（不留 false）
  function toggleManualDone(manualDoneMap, id, nextState) {
    const key = String(id);
    const base = manualDoneMap || {};
    const target = typeof nextState === 'boolean' ? nextState : !base[key];
    if (target) {
      return { ...base, [key]: true };
    }
    const next = { ...base };
    delete next[key];
    return next;
  }

  // ── 清理手動完成 map，只留 truthy 值 → { [String(id)]: true }──
  function normalizeManualDone(map) {
    const cleaned = {};
    Object.entries(map || {}).forEach(([id, value]) => {
      if (value) cleaned[String(id)] = true;
    });
    return cleaned;
  }

  return {
    isSubmitted,
    isManualDone,
    isManualUndone,
    isDone,
    toggleManualDone,
    normalizeManualDone,
  };
});
