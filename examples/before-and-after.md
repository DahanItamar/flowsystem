# One prompt, two runs

> **Prompt:** *"Build an employee shift app"*

The point isn't that Claude writes bad code without a spec. It's that with nine words of input, **there is nothing to write the right code against**, so it fills the gap with plausible guesses and moves on. The guesses are the problem.

Both implementations below are real files in this repo, and the bugs described are asserted by a test suite you can run yourself in one command:

```
node --test examples/proof/proof.test.mjs
```

No dependencies, no install. [What it proves →](proof/)

---

## Without the skill

Claude has to decide, silently, roughly a dozen things nobody asked it about: who uses this, whether data survives a refresh, what a shift *is*, whether two people can work at once, what happens at midnight. It picks the fastest plausible answer for each and starts typing.

```jsx
// src/App.jsx — the whole app
export default function App() {
  const [employees, setEmployees] = useState([
    { name: "Dana",  role: "lead" },
    { name: "Omri",  role: "barista" },
  ]);
  const [shifts, setShifts] = useState([]);

  function addShift(employee, day, start, end) {
    setShifts([...shifts, { employee, day, start, end }]);
  }

  const hasConflict = (s) =>
    shifts.filter(
      (o) => o.employee === s.employee && o.day === s.day &&
             o.start < s.end && o.end > s.start
    ).length > 1;

  return (
    <div className="grid">
      {employees.map((e) => (
        <Row key={e.name} employee={e} shifts={shifts.filter((s) => s.employee === e.name)} />
      ))}
    </div>
  );
}
```

It runs. It demos. It is also already wrong in ways that won't surface for weeks:

| What it assumed | What it costs |
| --- | --- |
| An employee is identified by `name` | Renaming someone orphans every shift they've worked. There is no id to fix it with. |
| `day` is a free string | `"Mon"`, `"monday"`, and `"2026-08-03"` all typecheck. One of them will get written. |
| `start`/`end` are `"09:00"` strings | `o.start < s.end` is **string comparison**. It happens to work until a shift runs 22:00 → 06:00, then it silently reports no conflict. |
| State lives in `useState` | Refresh loses the schedule. Adding persistence later means rewriting every component that touches `shifts`. |
| Conflict logic lives in the component | It cannot be unit-tested, and the export path that also needs it will get a second, slightly different copy. |
| No availability or time-off concept | The feature the manager actually needs — *don't schedule someone who's off* — has nowhere to attach. |

None of this is visible in the demo. It surfaces the first time someone tries to add a real feature on top.

---

## With the skill

Same nine words. The skill reads the repo, finds nothing, and asks — in **one batch**, not one at a time:

```
┌─ Who uses it, and do they share data? ─────────────────────────┐
│ › One manager, one machine                                     │
│   A team, shared schedule                                      │
│   Employees log in too                                         │
└────────────────────────────────────────────────────────────────┘

┌─ What must it survive? ────────────────────────────────────────┐
│ › Closing the app                                              │
│   Losing the network mid-edit                                  │
│   Nothing — it's a prototype                                   │
└────────────────────────────────────────────────────────────────┘

┌─ Do shifts ever cross midnight? ───────────────────────────────┐
│ › Yes — night shifts are normal                                │
│   No, always within one day                                    │
└────────────────────────────────────────────────────────────────┘

┌─ Does anything block scheduling someone? ──────────────────────┐
│ › Weekly availability and approved time off                    │
│   Just don't double-book them                                  │
│   Nothing — the manager decides                                │
└────────────────────────────────────────────────────────────────┘
```

Four answers. Everything else it decides itself and records as a numbered assumption you can reject. Then it writes [`docs/SPEC.md`](shift-planner-spec.md) — and the third question alone has already prevented the string-comparison bug above, because it forced the data model to be a decision instead of a default:

```ts
// from §5 Data Models
interface Shift {
  id: string;                    // nanoid(12)
  employeeId: string;            // FK → Employee.id — never the name
  date: string;                  // 'YYYY-MM-DD' local calendar date; a shift date has no timezone
  startMinute: number;           // 0–1439
  endMinute: number;             // may exceed 1440 for overnight shifts
}
```

And §4 put the rule somewhere it can be enforced rather than remembered:

> `domain/` imports no framework. The conflict engine is the highest-risk logic in the product, so it must be unit-testable without launching the app or touching a database.

The code that follows is shaped by both:

```ts
// src-core/domain/conflicts.ts — pure. No React, no DB, no Tauri.
export function detectConflicts(
  candidate: Shift,
  existing: Shift[],
  availability: Availability[],
  timeOff: TimeOff[],
  employee: Employee,
): Conflict[] {
  const conflicts: Conflict[] = [];

  const overlapping = existing.filter(
    (s) => s.id !== candidate.id &&
           s.employeeId === candidate.employeeId &&
           s.date === candidate.date &&
           s.startMinute < candidate.endMinute &&   // integers, not strings
           s.endMinute > candidate.startMinute
  );
  if (overlapping.length > 0) {
    conflicts.push({ kind: 'overlap', shiftIds: [candidate.id, ...overlapping.map((s) => s.id)], message: … });
  }

  if (isDuringTimeOff(candidate, timeOff))     conflicts.push({ kind: 'time_off',    … });
  if (!isWithinAvailability(candidate, availability)) conflicts.push({ kind: 'unavailable', … });
  if (weeklyMinutes(candidate, existing) > employee.maxHoursPerWeek * 60)
                                               conflicts.push({ kind: 'over_hours',  … });

  return conflicts;
}
```

Which means the case that would have shipped broken is now a test somebody can actually write — and this one is [in the repo](proof/proof.test.mjs), not pseudocode:

```js
test('catches the night shift running into the next morning', () => {
  const night = { id: 's1', employeeId: 'e1', date: '2026-08-03', startMinute: 1320, endMinute: 1800 }; // 22:00 → 06:00
  const early = { id: 's2', employeeId: 'e1', date: '2026-08-04', startMinute: 300,  endMinute: 780  }; // 05:00 → 13:00

  const c = detectConflicts(early, [night]);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].shiftIds.sort(), ['s1', 's2']);
});
```

---

## Run it

Both implementations are fed the same three scenarios in their own shapes:

```
$ node --test examples/proof/proof.test.mjs

▶ naive — no spec, shapes chosen by whatever was convenient
  ✔ detects a plain same-day overlap
  ✔ MISSES a night shift running into the next morning — the manager sees no warning
  ✔ MISSES the same overlap when a time is not zero-padded — "9:00" < "21:00" is false
  ✔ orphans every shift when an employee is renamed
▶ spec-derived — shapes chosen in §5 and §8
  ✔ detects a plain same-day overlap
  ✔ catches the night shift running into the next morning
  ✔ has no padding failure mode — minutes are integers, not text
  ✔ survives a rename — identity is an id, not a display name
  ✔ does not flag a different employee in the same slot

ℹ tests 13
ℹ pass 13
ℹ fail 0
```

(The suite has a third block too — the same spec-derived code three weeks later, after it drifted back into the bug. That's [the loop](the-loop.md).)

The naive block is green because those tests **assert the broken behaviour** — `assert.equal(naiveHasConflict(...), false)` passes precisely because no conflict is reported where a real one exists.

Note its first line. The naive check *works* on the easy case. That is why nobody catches it in review: it demos fine, it passes the obvious test, and it is wrong in exactly the two places a spec would have forced a decision. Full walkthrough in [`examples/proof/`](proof/).

---

## What actually changed

The second column isn't better code. It's the same model, given something to be correct *about*.

| | Without | With |
| --- | --- | --- |
| Identity | `name` string | `employeeId`, renames are safe |
| Time | `"09:00"` strings compared lexically | integer minutes, arithmetic works |
| Overnight shifts | silently no conflict | specified, tested, handled |
| Persistence | lost on refresh | SQLite, decided up front |
| Conflict rules | inline in JSX, untestable | pure function, one source of truth |
| Availability / time off | absent | modeled before the grid was built |
| Next session's code | invents new names and a second conflict check | reads `docs/SPEC.md` and matches §4 |

That last row is the one that compounds. A spec isn't primarily a planning artifact — it's the thing you load into the *next* context so session four doesn't quietly contradict session one.

---

[**← Full spec from this prompt**](shift-planner-spec.md) · [**Repo**](../README.md)
