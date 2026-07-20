(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.DueCustomAssignments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CUSTOM_PREFIX = 'custom-assignment-';

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function toDatetimeLocalValue(date) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join('-') + `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function getDefaultDueLocalValue(now = new Date()) {
    const due = new Date(now);
    due.setDate(due.getDate() + 7);
    due.setHours(23, 59, 0, 0);
    return toDatetimeLocalValue(due);
  }

  function normalizeCourseId(courseId) {
    const asNumber = Number(courseId);
    return Number.isFinite(asNumber) && String(courseId).trim() !== '' ? asNumber : courseId;
  }

  function defaultIdFactory() {
    const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${CUSTOM_PREFIX}${randomPart}`;
  }

  function createCustomAssignment(input) {
    const name = (input.name || '').trim();
    if (!name) throw new Error('name is required');

    const courseId = normalizeCourseId(input.courseId);
    const dueAt = input.dueLocalValue ? new Date(input.dueLocalValue).toISOString() : null;
    const idFactory = input.idFactory || defaultIdFactory;

    return {
      id: idFactory(),
      course_id: courseId,
      name,
      description: (input.description || '').trim(),
      due_at: dueAt,
      submission: null,
      points_possible: null,
      html_url: null,
      _isCustom: true,
      created_at: new Date().toISOString(),
    };
  }

  function normalizeCustomAssignment(assignment, fallbackCourseId) {
    if (!assignment || !assignment.id || !assignment.name) return null;
    const courseId = assignment.course_id != null
      ? assignment.course_id
      : normalizeCourseId(fallbackCourseId);
    return {
      ...assignment,
      course_id: normalizeCourseId(courseId),
      submission: null,
      _isCustom: true,
    };
  }

  function normalizeCustomAssignmentMap(customAssignments = {}) {
    const normalized = {};
    Object.entries(customAssignments || {}).forEach(([courseId, assignments]) => {
      const list = Array.isArray(assignments) ? assignments : [];
      const cleaned = list
        .map((assignment) => normalizeCustomAssignment(assignment, courseId))
        .filter(Boolean);
      if (cleaned.length) normalized[courseId] = cleaned;
    });
    return normalized;
  }

  function mergeAssignmentMaps(canvasAssignments = {}, customAssignments = {}) {
    const merged = {};
    const normalizedCustom = normalizeCustomAssignmentMap(customAssignments);
    const courseIds = new Set([
      ...Object.keys(canvasAssignments || {}),
      ...Object.keys(normalizedCustom),
    ]);

    courseIds.forEach((courseId) => {
      merged[courseId] = [
        ...((canvasAssignments && canvasAssignments[courseId]) || []),
        ...((normalizedCustom && normalizedCustom[courseId]) || []),
      ];
    });

    return merged;
  }

  return {
    CUSTOM_PREFIX,
    createCustomAssignment,
    getDefaultDueLocalValue,
    mergeAssignmentMaps,
    normalizeCustomAssignmentMap,
    toDatetimeLocalValue,
  };
});
