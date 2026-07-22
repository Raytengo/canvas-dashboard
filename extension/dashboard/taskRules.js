(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.DueTaskRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ═══════════════════════════════════════════════════════════════
  // Due 任務分類與緊急度規則（單一真相來源，dashboard 與 popup 共用）
  // 背景：2026-07-21 決策——考試類永久隱藏，但判定關鍵字必須收緊以防
  //       誤殺一般作業（「期中小組報告」曾被舊版含「期中」的規則吞掉）。
  // ═══════════════════════════════════════════════════════════════

  // ── 考試判定 ──
  // 英文：exam / quiz / midterm 完整詞；test 必須接數字（Test 1、Test-2、Test #3）
  //       才算，避免「Test plan」「Testing report」誤殺。
  // 中文：只匹配明確考試詞；單獨「期中」「期末」不再匹配。
  const EXAM_EN_RE = /\b(exam|quiz|midterm)\b/i;
  const EXAM_EN_TEST_RE = /\btest\s*[-#]?\d/i;
  const EXAM_ZH_KEYWORDS = ['考試', '考试', '測驗', '测验', '期中考', '期末考', '隨堂考', '随堂考', '小考'];

  function isExam(assignment) {
    if (!assignment) return false;
    if (assignment.is_quiz_assignment) return true;
    if ((assignment.submission_types || []).includes('online_quiz')) return true;
    const name = String(assignment.name || '');
    if (EXAM_EN_RE.test(name) || EXAM_EN_TEST_RE.test(name)) return true;
    return EXAM_ZH_KEYWORDS.some((k) => name.includes(k));
  }

  // ── 簽到/出勤判定（原 dashboard 與 popup 兩套關鍵字的聯集）──
  const ATTENDANCE_KEYWORDS = [
    'attendance', 'attendence', 'participation',
    'sign-in', 'sign in', 'check-in', 'check in', 'checkin',
    '簽到', '签到', '出勤', '考勤',
  ];

  function isAttendance(assignment) {
    if (!assignment) return false;
    const lower = String(assignment.name || '').toLowerCase();
    return ATTENDANCE_KEYWORDS.some((k) => lower.includes(k));
  }

  // ── 考試是否已結束（2026-07-22 決策）──
  // 考試時間一過即不可再行動（不像一般作業可補繳）→ 與「已繳」歸同一個完成桶，
  // 不進待辦/逾期清單；無截止日或日期無效則無從判定，維持未結束。
  function isExamConcluded(assignment, nowMs = Date.now()) {
    if (!assignment || !isExam(assignment) || !assignment.due_at) return false;
    const t = new Date(assignment.due_at).getTime();
    if (Number.isNaN(t)) return false;
    return t <= nowMs;
  }

  // ── 統一緊急度刻度（popup 舊版 ≤3 天才橘、dashboard ≤7 天橘，現收斂為一套）──
  // 'none' 無截止｜'overdue' 已過期｜'urgent' ≤7 天｜'soon' 8–30 天｜'later' 30 天以上
  const DAY_MS = 86400000;

  function urgency(dueAt, nowMs = Date.now()) {
    if (!dueAt) return 'none';
    const t = new Date(dueAt).getTime();
    if (Number.isNaN(t)) return 'none';
    const diff = t - nowMs;
    if (diff < 0) return 'overdue';
    const days = diff / DAY_MS;
    if (days <= 7) return 'urgent';
    if (days <= 30) return 'soon';
    return 'later';
  }

  // ── 逾期顯示窗 ──
  // 逾期超過此天數的項目不再進「學期待辦 / popup」的逾期區
  // （避免學期中途安裝時被整學期舊帳洗版；課程詳情仍看得到全部）。
  const OVERDUE_WINDOW_DAYS = 30;

  function isWithinOverdueWindow(dueAt, nowMs = Date.now()) {
    if (!dueAt) return false;
    const t = new Date(dueAt).getTime();
    if (Number.isNaN(t)) return false;
    const overdueMs = nowMs - t;
    return overdueMs >= 0 && overdueMs <= OVERDUE_WINDOW_DAYS * DAY_MS;
  }

  // ── 逾期天數（本地日曆天差，同日=0；顯示層對 0 用「今天」）──
  function overdueDays(dueAt, now = new Date()) {
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return 0;
    const dueDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const nowDayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((nowDayUtc - dueDayUtc) / DAY_MS));
  }

  return {
    isExam,
    isAttendance,
    isExamConcluded,
    urgency,
    isWithinOverdueWindow,
    overdueDays,
    OVERDUE_WINDOW_DAYS,
  };
});
