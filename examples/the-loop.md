# The loop

Two skills, one project, over five weeks. This is the whole workflow.

Everything below is backed by files in [`proof/`](proof/) — `node --test examples/proof/proof.test.mjs`, 13 tests, no dependencies.

---

## Day 1 — `spec-architect`

```
/flowsystem:spec-architect I want a desktop app for managing employee shifts
```

Four questions. One of them is *"do shifts ever cross midnight?"* — you answer yes, night shifts are normal.

It writes [`docs/SPEC.md`](shift-planner-spec.md). Two lines from it matter for this story:

```
§5   endMinute: number;   // may exceed 1440 for overnight shifts
§8   Overnight shift (22:00 → 06:00) — modeled as a negative duration,
     hour totals and overlap checks both go wrong.
     Handling: endMinute may exceed 1440.
```

That's a decision with a reason attached. It exists because without it, a night shift can't be represented at all.

## Weeks 1–3 — you build

The code follows the spec. Overnight shifts work. There's a test for it.

```js
test('catches the night shift running into the next morning', () => { … })  ✔
```

## Day 21 — the drift

A session working on form error messages adds input validation:

```js
if (shift.endMinute > 1439) {
  throw new RangeError('endMinute must be between 0 and 1439');
}
```

In isolation this is obviously correct. Minutes in a day run 0–1439. The reviewer agreed. **Every test still passed.**

Nobody re-read §8. It's four pages away, and nothing in this task pointed at it.

**What actually broke:** the manager types a 22:00 → 06:00 shift, gets a validation error on the form, shortens it to 22:00–23:59, and moves on. No warning fires. The overlap with the next morning's shift is never detected — because the night shift was never stored.

Same silence as having no spec at all. Five weeks later.

> Asserted in [`proof.test.mjs`](proof/proof.test.mjs):
> ```
> ✔ still handles ordinary shifts, so nothing looks wrong
> ✔ but the night shift can no longer be saved — §8 is contradicted
> ✔ and the rejection is silent: the overlap is simply never detected
> ```

## Day 24 — `spec-drift`

```
/flowsystem:spec-drift
```

It reads the spec, reads the code, and compares the claims that are actually checkable:

```
§8 Edge Cases — "endMinute may exceed 1440 for overnight shifts"
   src-core/domain/shift.rs:47   rejects endMinute > 1439

   REGRESSION. The spec recorded why: a 22:00 → 06:00 shift is otherwise
   unrepresentable, and overlap detection silently stops working for it.
   This validation reintroduces exactly the bug the constraint prevented.

   → Fix the code: drop the upper bound on endMinute
   → Or: the requirement changed — update §8 and record what replaced it

§5 Data Models — Employee
   src/db/schema.sql:12   has `phone TEXT NULL`, absent from the spec

   STALE. No decision governs contact details.
   → Add to §5
```

Two gaps, two different verdicts.

The first is a **regression** — the code contradicts a section that recorded a *reason*, so the spec is right and the code broke. The second is **staleness** — nothing forbade it, the document is just behind.

You pick a direction for each. It applies them.

---

## Why the verdict matters more than the finding

The tempting default is to update the spec whenever the two disagree. It's fast and it always resolves the gap.

It's also how a spec ends up documenting its own bugs. Rewrite §8 to say *"endMinute must be 0–1439"* and the night-shift bug is now **the specification**. It will never be found again — not by the next check, not by the next developer, not by the next Claude session reading the file as ground truth.

So the rule is:

> A gap against a section that recorded a *reason* is a regression until proven otherwise.

§3 Decisions, §8 Edge Cases, and §9 Security all carry reasons. Code contradicting one of them almost always means a later session didn't know. Everything else is ordinary staleness — update the document and move on.

---

## The loop

```
      your idea
          │
          ▼
   spec-architect ──────► docs/SPEC.md ──────► you build
                                ▲                  │
                                │                  │
                                └──── spec-drift ◄─┘
                                    keeps it true
```

`spec-architect` runs once, at the start. `spec-drift` runs whenever you come back to the project — after a milestone, before a new feature, or when you've been away long enough to not trust the document.

Without the second, the first is a document that's correct for about a month.
