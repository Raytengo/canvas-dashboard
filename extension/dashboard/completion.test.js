const assert = require('node:assert/strict');
const DueCompletion = require('./completion.js');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

// ── isSubmitted ──
test('isSubmitted: submitted_at set → true', () => {
  assert.equal(DueCompletion.isSubmitted({ submission: { submitted_at: '2026-03-06T10:00:00Z' } }), true);
});

test('isSubmitted: workflow_state submitted → true', () => {
  assert.equal(DueCompletion.isSubmitted({ submission: { workflow_state: 'submitted' } }), true);
});

test('isSubmitted: workflow_state graded → true', () => {
  assert.equal(DueCompletion.isSubmitted({ submission: { workflow_state: 'graded' } }), true);
});

test('isSubmitted: submission null → false (暑假無繳交常態)', () => {
  assert.equal(DueCompletion.isSubmitted({ submission: null }), false);
});

test('isSubmitted: missing submission field → false', () => {
  assert.equal(DueCompletion.isSubmitted({ id: 1, name: 'x' }), false);
});

test('isSubmitted: unsubmitted workflow_state → false', () => {
  assert.equal(DueCompletion.isSubmitted({ submission: { workflow_state: 'unsubmitted' } }), false);
});

// ── isManualDone ──
test('isManualDone: numeric id hits string key via String() normalization', () => {
  assert.equal(DueCompletion.isManualDone({ '12345': true }, 12345), true);
});

test('isManualDone: string id hits key', () => {
  assert.equal(DueCompletion.isManualDone({ 'custom-assignment-abc': true }, 'custom-assignment-abc'), true);
});

test('isManualDone: empty map → false', () => {
  assert.equal(DueCompletion.isManualDone({}, 12345), false);
});

test('isManualDone: null map → false', () => {
  assert.equal(DueCompletion.isManualDone(null, 12345), false);
});

// ── isDone ──
test('isDone: Canvas-submitted + empty manualDone → true', () => {
  assert.equal(DueCompletion.isDone({ id: 1, submission: { workflow_state: 'submitted' } }, {}), true);
});

test('isDone: not submitted + manualDone has id → true', () => {
  assert.equal(DueCompletion.isDone({ id: 7, submission: null }, { '7': true }), true);
});

test('isDone: numeric id resolves against string manualDone key → true', () => {
  assert.equal(DueCompletion.isDone({ id: 7, submission: null }, { 7: true }), true);
});

test('isDone: neither submitted nor manual → false', () => {
  assert.equal(DueCompletion.isDone({ id: 7, submission: null }, {}), false);
});

test('isDone: empty map + submission null → false (暑假空清單情境)', () => {
  assert.equal(DueCompletion.isDone({ id: 99, submission: null }, {}), false);
});

// ── toggleManualDone ──
test('toggleManualDone: add then remove by flipping', () => {
  const added = DueCompletion.toggleManualDone({}, 7);
  assert.deepEqual(added, { '7': true });
  const removed = DueCompletion.toggleManualDone(added, 7);
  assert.deepEqual(removed, {});
});

test('toggleManualDone: explicit nextState true adds; false removes', () => {
  const added = DueCompletion.toggleManualDone({}, 'custom-1', true);
  assert.deepEqual(added, { 'custom-1': true });
  const removed = DueCompletion.toggleManualDone(added, 'custom-1', false);
  assert.deepEqual(removed, {});
});

test('toggleManualDone: normalizes numeric id to string key', () => {
  assert.deepEqual(DueCompletion.toggleManualDone({}, 42, true), { '42': true });
});

test('toggleManualDone: does NOT mutate the original map', () => {
  const original = { '1': true };
  const frozenSnapshot = { ...original };
  const next = DueCompletion.toggleManualDone(original, 2, true);
  assert.deepEqual(original, frozenSnapshot); // unchanged
  assert.deepEqual(next, { '1': true, '2': true });
  // removing also must not mutate input
  const afterRemove = DueCompletion.toggleManualDone(original, 1, false);
  assert.deepEqual(original, frozenSnapshot); // still unchanged
  assert.deepEqual(afterRemove, {});
});

test('toggleManualDone: handles null input map', () => {
  assert.deepEqual(DueCompletion.toggleManualDone(null, 5, true), { '5': true });
});

// ── normalizeManualDone ──
test('normalizeManualDone: drops false/0/null values, keeps true', () => {
  const cleaned = DueCompletion.normalizeManualDone({
    '1': true,
    '2': false,
    '3': 0,
    '4': null,
    '5': true,
  });
  assert.deepEqual(cleaned, { '1': true, '5': true });
});

test('normalizeManualDone: null/undefined input → {}', () => {
  assert.deepEqual(DueCompletion.normalizeManualDone(null), {});
  assert.deepEqual(DueCompletion.normalizeManualDone(undefined), {});
});
