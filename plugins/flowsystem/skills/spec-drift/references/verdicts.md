# Verdicts

Every gap gets exactly one verdict. Getting this wrong in the safe-looking direction is how a spec ends up documenting its own bugs.

---

## The asymmetry

The two mistakes are not equally bad.

**Calling a regression "staleness"** rewrites the spec to bless a bug. The gap disappears from every future check, the reason someone recorded is deleted, and the bug is now the documented behavior. Nobody will catch it again.

**Calling staleness a "regression"** wastes a few minutes and mildly annoys the user.

So when the evidence is balanced, lean toward regression. And when it isn't clear at all, say Undecided rather than picking.

---

## Regression

**The code contradicts a section that recorded a reason.**

Sections that record reasons: **§3 Decisions** (`Because:`), **§8 Edge Cases** (`Consequence if unhandled`), **§9 Security** (the whole section), and any field in **§5** with a stated range or cascade behavior.

The reason is the evidence. Someone thought about this and wrote down what breaks. Code that contradicts it was almost certainly written by someone — or some session — that never read it.

**How to report:**

```
§8 Edge Cases — "endMinute may exceed 1440 for overnight shifts"
   src-core/domain/shift.rs:47   rejects endMinute > 1439

   REGRESSION. The spec recorded why: a 22:00 → 06:00 shift is otherwise
   unrepresentable, and overlap detection silently stops working for it.
   This validation reintroduces exactly the bug the constraint prevented.

   → Fix the code: drop the upper bound on endMinute, keep 0 ≤ startMinute ≤ 1439
   → Or: the requirement genuinely changed — update §8 and record what replaced it
```

Always quote the reason back. *"The spec says X"* is an argument from authority. *"The spec says X because night shifts break otherwise"* is an argument, and it's what lets the user overrule you intelligently.

**Default action:** fix the code.

**The override:** the user says the requirement really did change. Then it becomes a spec edit — but a *reasoned* one. Rewrite the Decision or Edge Case with the new position and what changed, never just delete the row. See "Rewriting a reason" below.

---

## Staleness

**The code did something new or different, and no stated reason forbade it.**

Typical: a field added, an endpoint renamed, a component that grew, a checkbox in §10 that's actually done.

The spec is simply behind. Update it.

```
§5 Data Models — Employee
   src/db/schema.sql:12   has `phone TEXT NULL`, absent from the spec

   STALE. No decision or edge case governs contact details.
   → Add to §5 with its nullability reason
```

**Default action:** update the spec.

**Watch for the trap:** something can look like staleness while contradicting a reason recorded elsewhere. A new `users` table is ordinary staleness — unless §9 says *"no auth: single-user local app"*, in which case it's an architecture reversal and every downstream section is now suspect. Before ruling staleness, check whether any Decision, Edge Case, Security claim, or §11 Assumption speaks to it.

---

## Undecided

**Both sides moved, or the spec's own intent is ambiguous.**

Present both readings and stop. Do not guess.

```
§6 Interfaces — `week_copy` returns `{ created, skipped }`
   src-core/commands/week.rs:88   returns `{ created, skipped, conflicts }`

   UNDECIDED. `conflicts` is new and nothing forbids it — but §7 says copy
   *skips* conflicting shifts rather than reporting them, so the two may
   describe different behaviours now.

   → If copy still skips: staleness, add the field to §6
   → If copy now reports instead of skipping: §7 is wrong too, and that's
     the bigger change
```

Undecided is not failure. It is the honest answer when the document and the code represent two different intentions and only a human knows which one is current.

---

## Rewriting a reason

When a Decision or Edge Case genuinely reversed, the record must survive the edit. The *why* is the most valuable content in a spec; a spec that has been drift-checked five times and lost a reason each time is back to being prose.

**Wrong** — the history is gone, and the next reader has no idea a tradeoff was ever made:

```
**Storage** — Postgres.
```

**Right** — the reversal is legible, and so is what it cost:

```
**Storage** — Postgres.
Because: a second planner was added (§11.1 no longer holds), so the data
  is shared and SQLite's single-writer model stopped fitting.
Instead of: SQLite — chosen originally for a single-user local app; that
  premise is gone.
Revisit if: never — reverting means removing multi-user support.
```

Same rule for an Edge Case: keep the trigger and the consequence, change only the handling, and note what changed it.

---

## Reporting order

1. **Invalidated assumptions** (§11) — one of these usually invalidates several sections at once. Lead with it and name what it takes down.
2. **Security regressions** (§9)
3. **Other regressions** (§3, §5, §8)
4. **Undecided**
5. **Staleness** — grouped and summarized, not enumerated one by one

If there are more than about ten staleness items, don't list them individually. Say *"14 fields across 3 entities are missing from §5"* and offer to add them in one pass. A long list buries the two findings that mattered, which defeats the purpose of running the check.

## When there is nothing

Say so plainly and stop:

> No drift found. §4, §5, §6, §8, and §9 all match the code as of `a3f9c21`.

That is a genuinely useful result. Never pad it with speculative findings to look thorough — a report that cries wolf once gets ignored forever, and then the spec dies anyway.
