// The conflict check from the "without the skill" run in ../before-and-after.md,
// lifted out of the component unchanged.
//
// A shift here is whatever the component happened to put in state:
//   { employee: "Dana", day: "2026-08-03", start: "09:00", end: "17:00" }
//
// Nothing forced those shapes. `employee` is a display name because that was what
// was on hand; `start`/`end` are strings because that is what an <input type="time">
// gives you; `day` is a string because no one decided what a day was.

export function naiveHasConflict(candidate, others) {
  return others.some(
    (o) =>
      o.employee === candidate.employee &&
      o.day === candidate.day &&
      o.start < candidate.end &&
      o.end > candidate.start
  );
}

// Renaming someone, as the UI would do it.
export function naiveRename(employees, from, to) {
  return employees.map((e) => (e.name === from ? { ...e, name: to } : e));
}

// How the grid finds an employee's shifts.
export function naiveShiftsFor(employee, shifts) {
  return shifts.filter((s) => s.employee === employee.name);
}
