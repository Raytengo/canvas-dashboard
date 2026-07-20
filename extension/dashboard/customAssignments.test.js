const assert = require('node:assert/strict');
const DueCustomAssignments = require('./customAssignments.js');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

test('default due value is seven days later at 23:59 local time', () => {
  const value = DueCustomAssignments.getDefaultDueLocalValue(new Date(2026, 2, 6, 10, 15));
  assert.equal(value, '2026-03-13T23:59');
});

test('creates a custom assignment with trimmed fields and ISO due date', () => {
  const assignment = DueCustomAssignments.createCustomAssignment({
    courseId: '42',
    name: '  Project draft  ',
    description: '  Bring outline  ',
    dueLocalValue: '2026-03-13T23:59',
    idFactory: () => 'custom-fixed-id',
  });

  assert.equal(assignment.id, 'custom-fixed-id');
  assert.equal(assignment.course_id, 42);
  assert.equal(assignment.name, 'Project draft');
  assert.equal(assignment.description, 'Bring outline');
  assert.equal(assignment.due_at, new Date(2026, 2, 13, 23, 59).toISOString());
  assert.equal(assignment._isCustom, true);
});

test('rejects blank assignment names', () => {
  assert.throws(() => {
    DueCustomAssignments.createCustomAssignment({
      courseId: '42',
      name: '   ',
      dueLocalValue: '2026-03-13T23:59',
    });
  }, /name is required/);
});

test('merges Canvas and custom assignments by course id without mutating inputs', () => {
  const canvasAssignments = {
    42: [{ id: 1, name: 'Canvas item', due_at: '2026-03-10T00:00:00.000Z' }],
  };
  const customAssignments = {
    42: [{ id: 'custom-1', name: 'Custom item', course_id: 42, due_at: '2026-03-11T00:00:00.000Z' }],
    99: [{ id: 'custom-2', name: 'Other item', course_id: 99, due_at: null }],
  };

  const merged = DueCustomAssignments.mergeAssignmentMaps(canvasAssignments, customAssignments);

  assert.deepEqual(merged[42].map((a) => a.name), ['Canvas item', 'Custom item']);
  assert.deepEqual(merged[99].map((a) => a.name), ['Other item']);
  assert.equal(canvasAssignments[42].length, 1);
});
