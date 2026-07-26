# Proof

The claims in [before-and-after.md](../before-and-after.md) are executable. Zero dependencies, no install:

```
node --test examples/proof/proof.test.mjs
```

Requires Node 18+. It also runs on every push — see [`.github/workflows/test.yml`](../../.github/workflows/test.yml).

## What runs

Three versions of the same feature — *does this shift conflict with an existing one?*

| File | What it is |
| --- | --- |
| [`naive.mjs`](naive.mjs) | The check from the "without the skill" run, lifted out of the component unchanged. A shift is `{ employee, day, start, end }` — all strings, because nothing forced otherwise. |
| [`spec-derived.mjs`](spec-derived.mjs) | The same feature built against §5 and §8 of [the spec](../shift-planner-spec.md). A shift is `{ id, employeeId, date, startMinute, endMinute }`. |
| [`drifted.mjs`](drifted.mjs) | `spec-derived.mjs` three weeks later, after one locally sensible validation change silently reversed §8. This is what [`spec-drift`](../the-loop.md) exists to catch. |

The first two are fed the same three scenarios in their own shapes.

## Output

```
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
▶ drifted — the code three weeks after the spec was written
  ✔ still handles ordinary shifts, so nothing looks wrong
  ✔ but the night shift can no longer be saved — §8 is contradicted
  ✔ and the rejection is silent: the overlap is simply never detected
  ✔ the spec still says the opposite — this is what spec-drift reports

ℹ tests 13
ℹ pass 13
ℹ fail 0
```

## Read the first block carefully

Every test passes, including the naive ones — because the naive tests **assert the broken behaviour**. `assert.equal(naiveHasConflict(...), false)` passes precisely because the check reports no conflict where a real one exists. They are green evidence that the bugs are real.

The first naive test matters as much as the failures: the naive check *works* on the easy case. That is why nobody catches it in review. It demos fine, it passes the obvious test, and it is wrong in exactly the two places a spec would have forced a decision:

- **`day` is a string and times are strings.** A shift that starts at 22:00 and ends at 06:00 belongs to two days, and the model has no way to say so. The check compares `day` for equality, finds `'2026-08-03' !== '2026-08-04'`, and returns early. The manager sees no warning.
- **`'9:00' < '21:00'` is `false`.** Lexical comparison, not chronological. Nothing in the naive model requires zero-padding, so the day one `<input>` yields an unpadded value, overlap detection silently stops working for that row.
- **Identity is a display name.** Rename Dana to Dana Cohen and `naiveShiftsFor` returns zero shifts. Her history is intact in memory and unreachable.

None of these are exotic. Night shifts are normal in the exact domain the app was requested for.

## What actually fixed it

Not better code — a decided data model. Three lines of the spec do all the work:

```
§5  employeeId: string;      // FK → Employee.id — never the name
§5  startMinute: number;     // 0–1439
§8  endMinute: number;       // may exceed 1440 for overnight shifts
```

Once `endMinute` is allowed past 1440, an overnight shift is *representable*, and both shifts can be mapped onto one continuous minute timeline where midnight stops being a special case. The overlap test then becomes the same two comparisons it always was — they just operate on integers that mean what they say.

The skill asked *"do shifts ever cross midnight?"* before any of this was written. That one question is the whole difference.

## And then it drifted back

The third block is the sequel, and the reason there are two skills rather than one.

[`drifted.mjs`](drifted.mjs) is the spec-derived version three weeks later. A session working on form error messages added an obviously correct bound — minutes in a day run 0–1439, so reject anything above. The reviewer agreed. Every existing test still passed.

It reversed §8. The night shift became unrepresentable again, the save silently fails, and the overlap goes undetected — the exact bug the spec prevented, back after five weeks:

```js
assert.equal(specAllows, true);    // §5: endMinute may exceed 1440
assert.equal(codeAllows, false);   // code: throws above 1439
assert.notEqual(specAllows, codeAllows);
```

That last assertion is the gap `spec-drift` reports. Nothing about the drifted code looks wrong in isolation — which is precisely why nobody catches it without comparing the two artifacts on purpose. Full walkthrough in [the-loop.md](../the-loop.md).
