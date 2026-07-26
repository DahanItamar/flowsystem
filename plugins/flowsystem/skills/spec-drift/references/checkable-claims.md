# Checkable Claims

What can actually be verified, section by section. Work only from this list.

Most of a spec is context, intent, and reasoning — none of it checkable. Extracting a "claim" from prose that never made one produces a confident finding about something nobody asserted, and one of those teaches the user to ignore the entire report.

**The test for a claim:** could a reasonable person point at a file and say *"this contradicts it"*? If not, skip it.

---

## §3 Architecture

| Claim | How to verify |
| --- | --- |
| A named component exists | Find its directory or entry point. `commands/`, `domain/`, a service module. |
| Its stated technology | Check the manifest — `package.json`, `Cargo.toml`, `pyproject.toml`. A spec saying Fastify against a repo running Express is a real gap. |
| A **Decision**'s outcome holds | The chosen thing is present and the rejected alternative is absent. "SQLite, not Postgres" is contradicted by a `pg` dependency. |
| Something the spec excluded is absent | "No backend" is contradicted by a server entry point. "No message broker" by a queue client. |

**Not checkable:** the overview prose, the diagram, "Revisit if" conditions.

Decisions carry a stated reason, so a contradiction here is a **regression**, not staleness.

---

## §4 Project Layout & Conventions

The most mechanically checkable section, and the one that drifts most invisibly.

| Claim | How to verify |
| --- | --- |
| Directory layout | Every named directory exists. Flag directories present in code but absent from the spec — that's usually where undocumented work accumulated. |
| **Dependency direction** | The highest-value check here. If the spec says `domain/` imports no framework, grep its imports for the framework. A violation is a regression: the rule existed for a reason. |
| No circular imports | Run the project's own check if one is configured (`madge --circular`, `import-linter`). |
| Naming conventions | Sample, don't exhaustively audit. Ten files against the file-naming rule; the DB schema against the table/column rules. Report the pattern, not every instance. |
| Size limits | Only if the spec says they're linter-enforced. If so, confirm the linter config actually contains them — a stated limit with no rule behind it is itself the finding. |
| Named tooling | The formatter, linter, and type checker in the spec exist in config and in CI. |

**Not checkable:** whether the conventions are *good*.

---

## §5 Data Models

Compare the spec's types against the real schema — migrations, ORM models, or DDL, whichever is authoritative. Not against the TypeScript interfaces, which are frequently a stale mirror themselves.

| Claim | How to verify |
| --- | --- |
| Entity exists | A table or model per entity in the spec. |
| Every field | Present, and named as specified. |
| Type | Matches. `startMinute: number` against a `TEXT` column is a real finding. |
| **Nullability** | Matches. The spec makes optionality a stated decision; a field that quietly became nullable is a data-integrity change nobody signed off on. |
| **Stated value ranges** | Where the spec gives one — `0–1439`, `may exceed 1440`, `0–60` — check the validation code enforces exactly that. Not narrower, not wider. A narrower bound is the classic regression: it looks like defensive validation and it silently breaks a documented case. |
| Relationships & cascade | The FK exists, and `ON DELETE` matches. `RESTRICT` silently becoming `CASCADE` is unrecoverable data loss on a delete. |
| Constraints & indexes | Each unique constraint and index in the spec exists in a migration. |
| Fields in code, absent from spec | Ordinary staleness — add them. |

---

## §6 Interfaces

| Claim | How to verify |
| --- | --- |
| Every listed endpoint/channel/command exists | Search the router, the IPC registration, the CLI definition. Search widely before concluding it's missing. |
| Request and response shape | Against the validation schema (Zod, Pydantic, serde) where one exists. |
| Error cases | The stated status codes and error kinds are actually produced. |
| **Interfaces in code, absent from the spec** | For a plain HTTP API this is staleness. For an **allowlist** — IPC channels, a Tauri capability list, a permissions set — it is a **regression**: the spec asserted the surface was closed, and it isn't anymore. Read the spec's wording. "No other channels are registered" is a security claim. |

---

## §8 Edge Cases & Failure Modes

Every row here has a stated handling. Check it exists.

| Claim | How to verify |
| --- | --- |
| The specified handling is present | Find the guard, the transaction, the retry, the constraint. |
| It handles the stated trigger | Not merely something adjacent. A transaction wrapping the wrong two statements does not satisfy the case. |
| A test covers it, if the spec says one does | The test exists and is not skipped. |

Every row in this section carries a *consequence if unhandled* — an explicit reason. **Contradictions here are regressions, always.** This is the section a drifting codebase quietly reverses, because each individual change looks locally sensible.

---

## §9 Security & Permissions

Highest stakes, so verify by reading rather than pattern-matching.

| Claim | How to verify |
| --- | --- |
| The stated **enforcement point** exists | Middleware, RLS policy, repository layer — whatever §9 names as the one place. |
| It is actually used on every path | The expensive check, and the one that matters. A middleware that exists but isn't applied to three routes is a real vulnerability and a true regression. |
| The role table matches the code | Each role's stated permissions are what the checks implement. |
| Stated data handling holds | Hashing algorithm, "not encrypted at rest", retention, deletion cascade. |
| Absences that were deliberate | "No auth — single-user local app" is contradicted by a login route. "No network calls" by an HTTP client. These are architecture-level reversals, always worth reporting. |

---

## §10 Build Order

| Claim | How to verify |
| --- | --- |
| Checked-off items are actually done | A ticked box whose code doesn't exist is worth flagging. |
| Unchecked items that are done | Staleness — tick them. |

---

## Sections to skip entirely

**§1 Problem & Users**, **§2 Scope**, **§7 Core Flows** (prose steps, not assertions), **§11 Assumptions**, **§12 Open Questions**.

One exception worth the time: if an **Assumption** in §11 has since been proven false by the code — the spec assumed one user and there's now a login system — that is the single most valuable finding a drift check can produce. An invalidated assumption usually means several downstream sections are wrong at once. Report it first, and say which sections it takes with it.
