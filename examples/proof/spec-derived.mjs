// The same feature, built against §5 (Data Models) and §8 (Edge Cases) of
// ../shift-planner-spec.md.
//
// A shift is what the spec says it is:
//   { id, employeeId, date: 'YYYY-MM-DD', startMinute: 0-1439, endMinute: may exceed 1440 }
//
// Three constraints from the spec do all the work here:
//   §5  identity is `employeeId`, never a name
//   §5  time is integer minutes, never a formatted string
//   §8  `endMinute` may exceed 1440, so an overnight shift is representable at all

const MINUTES_PER_DAY = 1440;

// 'YYYY-MM-DD' -> integer day number. A shift date is a calendar date with no
// timezone (§8), so this must never go through a local-time Date constructor.
function dayNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

// Absolute minute range on a single continuous timeline, which is what makes
// midnight stop being a special case.
function toRange(shift) {
  const start = dayNumber(shift.date) * MINUTES_PER_DAY + shift.startMinute;
  return { start, end: start + (shift.endMinute - shift.startMinute) };
}

export function detectConflicts(candidate, existing) {
  const conflicts = [];
  const a = toRange(candidate);

  const overlapping = existing.filter((s) => {
    if (s.id === candidate.id) return false;
    if (s.employeeId !== candidate.employeeId) return false;
    const b = toRange(s);
    return a.start < b.end && a.end > b.start;
  });

  if (overlapping.length > 0) {
    conflicts.push({
      kind: 'overlap',
      shiftIds: [candidate.id, ...overlapping.map((s) => s.id)],
      message: 'Already scheduled during this time',
    });
  }

  return conflicts;
}

export function rename(employees, id, name) {
  return employees.map((e) => (e.id === id ? { ...e, name } : e));
}

export function shiftsFor(employee, shifts) {
  return shifts.filter((s) => s.employeeId === employee.id);
}
