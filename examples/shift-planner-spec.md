# Example output — Shift Planner

This is what `spec-architect` produces. The entire input was one sentence:

> *"I want to build a desktop app for managing employee shifts."*

Four questions followed (who uses it · is data shared · offline behavior · payroll integration), then this document. Note what the spec **refuses** to include: no server, no auth, no cloud sync — because the answers didn't justify them.

---

# Shift Planner — Technical Spec

> Status: Draft · Spec version 1.0

## 1. Problem & Users

A shift manager at a single site rebuilds next week's schedule in Excel every Thursday. Conflicts — double-booked staff, someone scheduled through their time-off request, a shift with nobody on it — surface on Sunday when the schedule is already printed and distributed.

**Primary user:** one shift manager, on one Windows machine, planning 10–40 employees a week.
**Success looks like:** conflicts are visible while building the schedule, not after it's published.

## 2. Scope

### In scope

- Create, edit, and delete employees with weekly availability
- Build a week's schedule by placing shifts on a day/employee grid
- Flag conflicts live: overlap, unavailability, over-hours
- Copy a previous week as a starting point
- Export the finished week to PDF and CSV

### Explicitly out of scope

- Employee logins or any employee-facing view — the manager is the only user (§11.1)
- Cloud sync or multi-device — one machine, one file
- Payroll calculation — export feeds the existing payroll system, it doesn't replace it
- Mobile app — v2 at the earliest
- Shift swap requests — needs an employee-facing surface, which is out of scope above

## 3. Architecture

### Overview

A single-user desktop application with a local SQLite file. No network, no server, no accounts — the OS user account is the security boundary. The renderer holds no data logic; all reads and writes cross a narrow IPC allowlist into the Rust core.

```
┌────────────────────────────┐
│  Renderer (React + Vite)   │
│  grid UI, conflict badges  │
└─────────────┬──────────────┘
              │ IPC: invoke (8 named commands, typed payloads)
┌─────────────▼──────────────┐
│  Core (Rust / Tauri)       │
│  validation, conflict calc │
│  export generation         │
└─────────────┬──────────────┘
              │ SQL (sqlx, synchronous)
┌─────────────▼──────────────┐
│  SQLite  ~/AppData/…/db    │
└────────────────────────────┘
```

### Components

| Component | Responsibility | Technology |
| --- | --- | --- |
| Renderer | Schedule grid, forms, conflict display. Holds no business rules. | React 18 + Vite, TypeScript |
| Core | Conflict detection, validation, persistence, export. Single source of truth. | Rust, Tauri 2 |
| Store | Employees, availability, shifts, time off. | SQLite via `sqlx`, WAL mode |

### Decisions

**Desktop framework** — Tauri over Electron.
Because: the app ships to non-technical users on managed work machines; a 12 MB installer is materially easier to get approved than 150 MB, and idle memory matters on the older hardware in use.
Instead of: Electron — faster to build with a JS-only team, but the bundle size was the stated friction.
Revisit if: the team has no Rust capacity at all, or a Node-only library becomes essential.

**Conflict detection in the core, not the renderer** — Rust owns the rules.
Because: conflict rules also gate export and must not be bypassable by a UI path that forgot to check.
Instead of: TypeScript in the renderer — one less IPC round trip, but two implementations of the same rule drift.
Revisit if: grid interaction latency becomes noticeable (measure before moving).

**No server** — local file only.
Because: one manager, one machine, no sharing requirement. A backend would add auth, hosting, and backup obligations that buy nothing here.
Revisit if: a second site or a second planner appears — at that point this becomes a different product, not a migration.

## 4. Project Layout & Conventions

### Directory layout

```
src-core/                  # Rust, Tauri main process
├── commands/              # One file per IPC group. The complete public surface — nothing
│                          #   is reachable from the renderer unless it is registered here.
│   ├── employees.rs
│   ├── week.rs
│   └── export.rs
├── domain/                # Conflict rules, hour math, validation. No Tauri, no sqlx.
├── db/                    # Schema, migrations, queries. The only place SQL lives.
├── config.rs              # Path resolution, first-run setup. Fails loudly at boot.
└── main.rs                # Wiring + the IPC allowlist. Nothing else.

src-ui/                    # React renderer
├── features/
│   ├── grid/              # Schedule grid: components + hooks + local state, colocated
│   ├── employees/
│   └── export/
├── components/            # Shared presentational. No IPC calls.
├── lib/ipc.ts             # The single typed wrapper around invoke(). Nothing else calls it.
└── App.tsx

docs/SPEC.md               # This document
```

### Dependency direction

```
src-ui  →  commands/  →  domain/  ←  db/
                            ↑
                      (imports nothing)
```

`domain/` is plain Rust — no Tauri, no sqlx, no async. The conflict engine is the highest-risk logic in the product, so it must be unit-testable without launching the app or touching a database. Nothing in `db/` or `commands/` may be imported by it.

The renderer reaches the core **only** through `lib/ipc.ts`. No component calls `invoke()` directly; that keeps the eight commands in §6 an enforceable list rather than an aspiration.

### Naming

| Kind | Convention | Example |
| --- | --- | --- |
| Rust module / file | snake_case | `conflict_engine.rs` |
| Rust type | PascalCase noun | `ShiftRepository`, `Conflict` |
| Rust function | snake_case verb | `detect_conflicts` |
| IPC command | `noun_verb`, snake_case | `week_load`, `shift_upsert` |
| TS component file | PascalCase | `ShiftGrid.tsx` |
| TS module file | kebab-case | `week-range.ts` |
| Boolean | `is_` / `has_` prefix, never negated | `is_active` |
| DB table | snake_case plural | `shifts`, `time_off` |
| DB column | snake_case singular | `employee_id`, `start_minute` |
| Timestamp column | `*_at`, UTC | `created_at` |

No abbreviations beyond `id`, `db`, and `ui`. `emp`, `sched`, and `cfg` are not used.

Banned as type suffixes: `Manager`, `Helper`, `Util`, `Data`, `Info`. In a shift-scheduling app, `ShiftManager` is genuinely ambiguous between a domain concept and a code smell — which is the reason for the rule.

### Size limits

Enforced by clippy and ESLint, not by review opinion.

| Unit | Soft | Hard |
| --- | --- | --- |
| File | 300 lines | 500 |
| Function | 40 lines | 80 |
| Parameters | 3 | 4 (then a struct) |
| Nesting depth | 3 | 4 |
| React component JSX | 150 lines | 250 |

### Tooling

| Concern | Tool |
| --- | --- |
| Format | `rustfmt` · Prettier |
| Lint | `clippy -D warnings` · ESLint |
| Types | `tsconfig.strict: true` |
| Pre-commit | format + lint on staged files |
| CI | format, lint, typecheck, `cargo test` — all blocking |

No `unwrap()` outside tests. No `any`. Both are lint errors from commit one, because retrofitting either is a week nobody budgets.

## 5. Data Models

```ts
interface Employee {
  id: string;                    // nanoid(12)
  name: string;                  // 1–80 chars
  role: 'barista' | 'shift_lead' | 'manager';
  maxHoursPerWeek: number;       // integer, 0–60; drives the over-hours conflict
  active: boolean;               // false = hidden from the grid, history preserved
  createdAt: string;             // ISO 8601 UTC
}

interface Availability {
  id: string;
  employeeId: string;            // FK → Employee.id, ON DELETE CASCADE
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0 = Sunday
  startMinute: number;           // 0–1439, minutes from local midnight
  endMinute: number;             // 0–1439, must be > startMinute
}

interface Shift {
  id: string;
  employeeId: string;            // FK → Employee.id, ON DELETE RESTRICT
  date: string;                  // 'YYYY-MM-DD' local calendar date — a shift date has no timezone
  startMinute: number;           // 0–1439
  endMinute: number;             // may exceed 1440 for overnight shifts (see §8)
  note: string | null;           // null = no note; free text, 0–200 chars
}

interface TimeOff {
  id: string;
  employeeId: string;            // FK → Employee.id, ON DELETE CASCADE
  startDate: string;             // 'YYYY-MM-DD', inclusive
  endDate: string;               // 'YYYY-MM-DD', inclusive
  reason: string | null;         // null = unspecified; not required by the manager
}
```

**Relationships**

- `Employee` 1:N `Availability` — cascade delete; availability has no meaning without its employee
- `Employee` 1:N `Shift` — **restrict** delete; deleting someone with scheduled shifts must fail loudly rather than silently erase history. UI offers deactivate instead.
- `Employee` 1:N `TimeOff` — cascade delete

**Constraints & indexes**

- index `shift(date)` — the grid loads one week at a time; this is the hot query
- index `shift(employee_id, date)` — serves overlap detection
- check `availability.end_minute > availability.start_minute`
- check `time_off.end_date >= time_off.start_date`

## 6. Interfaces

### IPC channels (renderer → core, all request/response)

| Command | Purpose | Request → Response | Errors |
| --- | --- | --- | --- |
| `employees_list` | Grid row headers | `{ includeInactive: boolean }` → `Employee[]` | — |
| `employee_upsert` | Create or edit | `Employee` → `Employee` | `VALIDATION` on bad field |
| `employee_deactivate` | Soft-hide | `{ id: string }` → `void` | `NOT_FOUND` |
| `week_load` | Grid contents | `{ weekStart: string }` → `{ shifts: Shift[]; timeOff: TimeOff[] }` | `VALIDATION` if not a Monday |
| `shift_upsert` | Place or move a shift | `Shift` → `{ shift: Shift; conflicts: Conflict[] }` | `VALIDATION`, `NOT_FOUND` |
| `shift_delete` | Remove | `{ id: string }` → `void` | `NOT_FOUND` |
| `week_copy` | Seed from a prior week | `{ from: string; to: string }` → `{ created: number; skipped: number }` | `CONFLICT` if target non-empty |
| `week_export` | PDF or CSV | `{ weekStart: string; format: 'pdf' \| 'csv' }` → `{ path: string }` | `IO` on write failure |

No other channels are registered. The renderer has no filesystem, shell, or network capability — the Tauri allowlist grants only `dialog.save`, used by `week_export`.

```ts
interface Conflict {
  kind: 'overlap' | 'unavailable' | 'over_hours' | 'time_off';
  shiftIds: string[];
  message: string;              // pre-formatted for display; the core owns the wording
}
```

## 7. Core Flows

### Placing a shift

1. Manager drags onto a grid cell → renderer calls `shift_upsert` with a draft shift
2. Core validates field ranges → rejects with `VALIDATION` before touching the DB
3. Core writes the shift, then recomputes conflicts for that employee across the whole week
4. Core returns the saved shift plus its conflict list
5. Renderer paints the cell and badges any conflicts

**Failure branches:** a conflict is **not** an error — the shift saves and the badge appears. Managers routinely need to schedule a known conflict and resolve it afterward; blocking the save would push them back to Excel.

### Copying last week

1. Manager picks a source week → renderer calls `week_copy`
2. Core refuses if the target week already has shifts (`CONFLICT`) — no silent merge
3. Core copies each shift forward by date offset, **skipping** any that land on time off
4. Core returns created and skipped counts; renderer shows "34 copied, 2 skipped (time off)"

## 8. Edge Cases & Failure Modes

| Case | Consequence if unhandled | Handling |
| --- | --- | --- |
| Overnight shift (22:00 → 06:00) | Modeled as a negative duration; hour totals and overlap checks both go wrong | `endMinute` may exceed 1440. Duration is `end - start`; overlap compares against the next day's window. Enforced by a core-level test. |
| DST transition weekend | A day is 23 or 25 hours; naive minute math misreports weekly totals | Shifts store a local calendar date plus minute offsets — never instants. DST cannot affect them. Documented so nobody "fixes" it into UTC timestamps later. |
| Employee deleted while holding shifts | Silent loss of schedule history | `ON DELETE RESTRICT`. The UI never offers delete for an employee with shifts — only deactivate. |
| First launch, no employees | Empty grid with no explanation; the most-seen screen in week one | Empty state with a single "Add your first employee" action. Specified in M1, not deferred. |
| DB file locked or corrupt | Silent data loss, or a crash with no explanation | WAL mode. On open failure: readable error naming the file path, plus an offer to open the containing folder. Never auto-delete. |
| Export target path unwritable | Silent no-op; the manager assumes it saved | `IO` error surfaced with the attempted path. |
| 40 employees × 7 days re-rendering per drag | Visible lag on the older machines this targets | Conflict recompute is scoped to the affected employee's week, not the full grid. Threshold to revisit: >100 employees. |

## 9. Security & Permissions

**Authentication:** none. Single-user local application; the OS account is the security boundary. This is a deliberate decision — do not add a login screen without first adding a second user (§11.1).

**Authorization:** not applicable. One role, full access.

**Data handling:**

- The SQLite file lives in the per-user app data directory and inherits OS file permissions. **It is not encrypted at rest** — anyone with the machine or a backup of it can read employee names and schedules. Acceptable for the stated deployment (managed single-user work machine); revisit before any shared or portable installation.
- Employee names are the only personal data stored. No addresses, no ID numbers, no pay rates.
- No network calls of any kind. No telemetry.
- No auto-update in v1 — an unsigned update channel is remote code execution, and code signing is out of scope for this milestone. Updates are manual installer downloads.

## 10. Build Order

**M1 — See a week**
Employees can be added; the grid renders a week and shifts can be placed and moved. Persists across restarts.
- [ ] SQLite schema + migration runner
- [ ] `employees_list`, `employee_upsert`, `week_load`, `shift_upsert`, `shift_delete`
- [ ] Grid with drag placement
- [ ] Empty state

**M2 — Catch the mistakes**
Conflicts appear live. This is the milestone that replaces Excel.
- [ ] Availability and time-off models + editors
- [ ] Conflict engine: overlap, unavailable, over_hours, time_off
- [ ] Badges and the conflict summary panel

**M3 — Get it out of the app**
- [ ] `week_export` — CSV then PDF
- [ ] `week_copy` with skip reporting

**M4 — Ship**
- [ ] Windows installer, first-run path creation
- [ ] DB open-failure recovery path

## 11. Assumptions

1. **One manager on one machine.** If a second planner appears, the no-server decision (§3) and the entire security model (§9) are wrong — that's a rewrite, not an extension.
2. **Windows only for v1.** Tauri makes macOS cheap later, but no macOS testing or signing is budgeted here.
3. **Weeks start Monday.** Hardcoded; a locale setting is a v2 concern.
4. **Payroll accepts CSV.** The exact column format is unconfirmed (§12).
5. **Under 100 employees.** Above that, revisit the grid rendering approach (§8).

## 12. Open Questions

- **What CSV columns does the payroll system expect?** — blocks: §6 `week_export` · needed by: M3
- **Do shift leads need different max-hours rules than baristas?** — blocks: the `over_hours` conflict rule · needed by: M2
- **Is a printed PDF actually used, or is CSV enough?** — blocks: whether PDF export is built at all · needed by: M3
