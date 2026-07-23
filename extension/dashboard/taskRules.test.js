const assert = require('node:assert/strict');
const DueTaskRules = require('./taskRules.js');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

const { isExam, isAttendance, urgency, isWithinOverdueWindow, overdueDays } = DueTaskRules;
const DAY = 86400000;

// ── isExam：該抓的要抓 ──
test('isExam: Midterm Exam → true', () => {
  assert.equal(isExam({ name: 'Midterm Exam' }), true);
});

test('isExam: Paper Reading Quiz 1 → true', () => {
  assert.equal(isExam({ name: 'Paper Reading Quiz 1' }), true);
});

test('isExam: Test 1 / Test-2 / Test #3（test 接數字）→ true', () => {
  assert.equal(isExam({ name: 'Test 1' }), true);
  assert.equal(isExam({ name: 'Test-2' }), true);
  assert.equal(isExam({ name: 'Test #3' }), true);
});

test('isExam: 期中考 / 期末考 / 隨堂考 / 小考 / 測驗 → true', () => {
  assert.equal(isExam({ name: '期中考' }), true);
  assert.equal(isExam({ name: '期末考安排' }), true);
  assert.equal(isExam({ name: '隨堂考 3' }), true);
  assert.equal(isExam({ name: '第五週小考' }), true);
  assert.equal(isExam({ name: '線上測驗' }), true);
});

test('isExam: Canvas 事實（is_quiz_assignment / online_quiz）→ true', () => {
  assert.equal(isExam({ name: 'Weekly reflection', is_quiz_assignment: true }), true);
  assert.equal(isExam({ name: 'Weekly reflection', submission_types: ['online_quiz'] }), true);
});

// ── isExam：不該抓的不能抓（舊版誤殺回歸測試）──
test('isExam: 期中小組報告大綱 → false（舊版「期中」誤殺案例）', () => {
  assert.equal(isExam({ name: '期中小組報告大綱' }), false);
});

test('isExam: 期中專題進度 / 期末報告 → false', () => {
  assert.equal(isExam({ name: '期中專題進度' }), false);
  assert.equal(isExam({ name: '期末報告' }), false);
});

test('isExam: Test plan / Testing report / Unit testing HW → false', () => {
  assert.equal(isExam({ name: 'Test plan submission' }), false);
  assert.equal(isExam({ name: 'Testing report' }), false);
  assert.equal(isExam({ name: 'Unit testing homework' }), false);
});

test('isExam: Examination of algorithms（exam 需完整詞）→ false', () => {
  assert.equal(isExam({ name: 'Examination of algorithms essay' }), false);
});

test('isExam: null / 空名稱 → false', () => {
  assert.equal(isExam(null), false);
  assert.equal(isExam({ name: '' }), false);
  assert.equal(isExam({}), false);
});

// ── isAttendance ──
test('isAttendance: attendance / 簽到 / 出勤 / participation → true', () => {
  assert.equal(isAttendance({ name: 'Week 3 Attendance' }), true);
  assert.equal(isAttendance({ name: '第三週簽到' }), true);
  assert.equal(isAttendance({ name: '出勤紀錄' }), true);
  assert.equal(isAttendance({ name: 'Class Participation' }), true);
});

test('isAttendance: 一般作業 → false', () => {
  assert.equal(isAttendance({ name: 'Programming Assignment 2' }), false);
  assert.equal(isAttendance(null), false);
});

// ── urgency（固定 nowMs 測邊界）──
const NOW = new Date('2026-07-21T12:00:00Z').getTime();

test('urgency: 無截止 / 無效日期 → none', () => {
  assert.equal(urgency(null, NOW), 'none');
  assert.equal(urgency('not-a-date', NOW), 'none');
});

test('urgency: 過期 → overdue', () => {
  assert.equal(urgency(new Date(NOW - 1000).toISOString(), NOW), 'overdue');
  assert.equal(urgency(new Date(NOW - 10 * DAY).toISOString(), NOW), 'overdue');
});

test('urgency: ≤7 天 → urgent（含恰好 7 天邊界）', () => {
  assert.equal(urgency(new Date(NOW + 1000).toISOString(), NOW), 'urgent');
  assert.equal(urgency(new Date(NOW + 7 * DAY).toISOString(), NOW), 'urgent');
});

test('urgency: 8–30 天 → soon（含恰好 30 天邊界）', () => {
  assert.equal(urgency(new Date(NOW + 7 * DAY + 1000).toISOString(), NOW), 'soon');
  assert.equal(urgency(new Date(NOW + 30 * DAY).toISOString(), NOW), 'soon');
});

test('urgency: 30 天以上 → later', () => {
  assert.equal(urgency(new Date(NOW + 30 * DAY + 1000).toISOString(), NOW), 'later');
});

// ── isWithinOverdueWindow ──
test('overdueWindow: 未過期 → false；剛過期 → true；30 天內 → true；超過 → false', () => {
  assert.equal(isWithinOverdueWindow(new Date(NOW + DAY).toISOString(), NOW), false);
  assert.equal(isWithinOverdueWindow(new Date(NOW - 1000).toISOString(), NOW), true);
  assert.equal(isWithinOverdueWindow(new Date(NOW - 30 * DAY).toISOString(), NOW), true);
  assert.equal(isWithinOverdueWindow(new Date(NOW - 31 * DAY).toISOString(), NOW), false);
  assert.equal(isWithinOverdueWindow(null, NOW), false);
});

// ── overdueDays（本地日曆天差）──
test('overdueDays: 同日 → 0；昨天 → 1；未來 → 0（夾住）', () => {
  const now = new Date('2026-07-21T20:00:00');
  assert.equal(overdueDays(new Date('2026-07-21T08:00:00').toISOString(), now), 0);
  assert.equal(overdueDays(new Date('2026-07-20T23:59:00').toISOString(), now), 1);
  assert.equal(overdueDays(new Date('2026-07-25T00:00:00').toISOString(), now), 0);
});

// ── isExamConcluded（考試時間已過＝已結束，歸入已完成桶；見 2026-07-22 決策）──
const { isExamConcluded } = DueTaskRules;

test('isExamConcluded: 過期考試 → true；未來考試 → false', () => {
  assert.equal(isExamConcluded({ name: 'Midterm Exam', due_at: new Date(NOW - DAY).toISOString() }, NOW), true);
  assert.equal(isExamConcluded({ name: 'Midterm Exam', due_at: new Date(NOW + DAY).toISOString() }, NOW), false);
});

test('isExamConcluded: 剛好到時 → true（due 即開考/結束時點，過了就不可再行動）', () => {
  assert.equal(isExamConcluded({ name: 'Final Quiz', due_at: new Date(NOW).toISOString() }, NOW), true);
});

test('isExamConcluded: 非考試過期 → false（一般作業仍可補繳，不歸這規則管）', () => {
  assert.equal(isExamConcluded({ name: 'Lab Report 3', due_at: new Date(NOW - DAY).toISOString() }, NOW), false);
});

test('isExamConcluded: 考試無截止日/日期無效 → false（無從判定結束）', () => {
  assert.equal(isExamConcluded({ name: 'Midterm Exam', due_at: null }, NOW), false);
  assert.equal(isExamConcluded({ name: 'Midterm Exam', due_at: 'not-a-date' }, NOW), false);
  assert.equal(isExamConcluded(null, NOW), false);
});

console.log('ALL taskRules TESTS PASSED');
