# Spec Template

The output structure. Follow this section order. Drop sections that genuinely don't apply to a small project — never reorder them, and never leave a heading with placeholder text under it.

Guidance below each heading is instruction to you, not content to copy.

---

````markdown
# <Project Name> — Technical Spec

> Status: Draft · <date> · Spec version 1.0

## 1. Problem & Users

<Two or three sentences on what breaks today and for whom. Concrete, not aspirational —
"shift managers rebuild next week's schedule in Excel every Thursday and mistakes surface
on Sunday" beats "streamline workforce management".>

**Primary user:** <who, and what they're trying to finish>
**Success looks like:** <one observable outcome — a task that takes less time, an error that stops happening>

## 2. Scope

### In scope
- <capability, phrased as something a user can do>

### Explicitly out of scope
- <thing a reader would reasonably assume is included> — <why not, or "v2">

<This second list is the more valuable one. It is where you park good ideas the user
didn't ask for: visible, but not committed.>

## 3. Architecture

### Overview

<Two or three sentences: the shape of the system and why it's that shape.>

```
<ASCII diagram. Boxes are components, arrows are labeled with the mechanism —
"HTTP/JSON", "IPC: invoke", "SQL". A diagram whose arrows are unlabeled
is decoration.>
```

### Components

| Component | Responsibility | Technology |
| --- | --- | --- |
| <name> | <one sentence, and what it explicitly does not do> | <specific: "Fastify 4", not "Node"> |

### Decisions

<The record that stops the same debate from happening in three weeks. One entry per
choice that had a real alternative. Skip the ones that didn't.>

**<Decision>** — <what was chosen>
Because: <the reason, tied to a requirement from §1 or §2>
Instead of: <alternative> — <why it lost>
Revisit if: <the specific condition that would change this>

## 4. Project Layout & Conventions

<From references/code-conventions.md. State only the rules this project will actually
follow — a convention nobody honors teaches readers the document is decoration.>

### Directory layout

```
<Top-level tree, one comment per directory stating what may live there and what may not.
A folder with no stated rule becomes the folder everything gets dumped into.>
```

### Dependency direction

<One line, then it's mechanical. e.g. "ui → services → domain ← db. domain/ imports no
framework and is testable with no app running.">

### Naming

| Kind | Convention | Example |
| --- | --- | --- |
| <only the rows that apply to this stack> | | |

### Size limits

<Only the ones you'll enforce in the linter — a limit that isn't enforced isn't a rule.>

| Unit | Soft | Hard |
| --- | --- | --- |

### Tooling

| Concern | Tool |
| --- | --- |
| Formatter / Linter / Types / CI | <named, so it's never a review discussion> |

## 5. Data Models

<Real code in the target language — TypeScript interfaces, Python dataclasses, SQL DDL,
Prisma schema. Not prose. Every field carries a type; every optional field is optional
for a stated reason.>

```ts
interface Example {
  id: string;              // nanoid(12)
  createdAt: string;       // ISO 8601 UTC
  archivedAt: string | null; // null = active; set on archive, never deleted (audit requirement §9)
}
```

**Relationships**

- `A` 1:N `B` — <cascade behavior on delete>
- `C` M:N `D` via `c_d` — <what the join table carries beyond the two keys>

**Constraints & indexes**

- unique: <field(s)> — <what it prevents>
- index: <field(s)> — <the query it serves>

## 6. Interfaces

<Every boundary between two components. Names and payloads, not descriptions.>

### <Boundary name — e.g. HTTP API / IPC Channels / CLI>

| Signature | Purpose | Request → Response | Errors |
| --- | --- | --- | --- |
| `POST /api/x` | <what it does> | `{...}` → `{...}` | `409` when <condition> |

<For IPC: channel name, direction, payload type, and whether it's fire-and-forget or
request-response. For CLI: full invocation with flags and exit codes.>

## 7. Core Flows

<The two to four paths that define the product. Numbered steps naming the component
acting at each one. If a flow can't be written as concrete steps, the design has a hole —
find it now rather than in week three.>

### <Flow name>

1. <Actor> <does thing> → <component> <responds>
2. …

**Failure branches:** <where this flow can break, and what the user sees>

## 8. Edge Cases & Failure Modes

<From references/risk-checklist.md — only items that can actually happen here.
Format: trigger → consequence → handling.>

| Case | Consequence if unhandled | Handling |
| --- | --- | --- |
| <trigger> | <what breaks> | <the decision> |

## 9. Security & Permissions

**Authentication:** <mechanism, session lifetime, storage — or "none, single-user local app; the OS account is the boundary">

**Authorization:**

| Role | Can | Cannot |
| --- | --- | --- |

**Enforcement point:** <where the check lives — middleware, RLS, repository layer. One place, named.>

**Data handling:** <secrets, PII, encryption at rest, retention, deletion cascade>

## 10. Build Order

<Milestones, each independently demoable. M1 must produce something visible — if the
first milestone is "set up infrastructure", reorder until it isn't.>

**M1 — <name>**
<What works at the end of this, stated as something you can show someone>
- [ ] <task>

**M2 — <name>**
…

## 11. Assumptions

<Numbered, so any one can be rejected by number. Every decision made without explicit
user confirmation belongs here — this is what makes the spec safe to write without
twenty questions.>

1. <assumption> — <what changes in the spec if it's wrong>

## 12. Open Questions

<Each tagged with what it blocks. A question that blocks nothing isn't open — it's a
detail, and it should have been decided.>

- **<question>** — blocks: <section or milestone> · needed by: <milestone>
````

---

## Notes on writing it

**Length follows stakes.** A weekend CLI tool uses sections 1, 3, 4, 5, 10 and nothing more. A multi-tenant product handling payments uses all twelve, with §9 carrying real weight. Padding a small idea into twelve pages is a failure in the same way that one paragraph for a payments system is.

**Tables over paragraphs** for anything enumerable. Prose is for reasoning; tables are for facts.

**No hedging.** "We should probably consider using…" is not a spec sentence. Decide, state the reason, note what would change your mind.

**Write for the reader who wasn't in the conversation.** This document exists to be loaded into a fresh context. Nothing in it may depend on something said in chat but not written down.
