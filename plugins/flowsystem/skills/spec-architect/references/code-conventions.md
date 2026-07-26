# Code Conventions

The layer that turns an architecture into a codebase someone else can navigate. Feeds §4 of the spec.

Pick the rules that apply, state them as decisions, and skip the rest. A convention nobody will follow is worse than none — it teaches readers that the document is decoration.

---

## 1. Top-level layout

Name every top-level directory and state what may live there. A folder without a stated rule becomes the folder everything gets dumped into.

### Web app — SPA + API

```
src/
├── api/            # HTTP layer: routes, request/response schemas. No business rules.
├── domain/         # Entities, business rules, pure logic. Imports no framework.
├── db/             # Schema, migrations, queries. The only place SQL lives.
├── services/       # Orchestration across domain + db. Where transactions start.
├── lib/            # Cross-cutting helpers with no domain knowledge.
└── config/         # Environment parsing and validation. Fails loudly at boot.

web/
├── routes/         # One file per URL. Data loading only, no layout.
├── features/       # Feature folders — components + hooks + local state, colocated.
├── components/     # Shared presentational components. No data fetching.
├── hooks/          # Shared hooks.
└── lib/            # API client, formatters, constants.
```

### Desktop (Tauri / Electron)

```
src-core/           # Rust or Node main process
├── commands/       # One file per IPC command group. The complete public surface.
├── domain/         # Business rules. Testable without the app running.
├── db/
└── main.rs|ts      # Wiring and the IPC allowlist. Nothing else.

src-ui/             # Renderer — same structure as web/ above
```

The renderer never reaches storage, the filesystem, or the network directly. Every crossing is a named command in `commands/`.

### CLI

```
src/
├── cli/            # Argument parsing, output formatting, exit codes.
├── commands/       # One file per subcommand. Thin — delegates immediately.
├── core/           # The actual work. Usable as a library, unaware of argv.
└── config/
```

`core/` must be callable without `cli/`. If it isn't, the tool can't be tested or scripted.

### Service / worker

```
src/
├── handlers/       # Entry points: HTTP, queue consumers, cron.
├── domain/
├── db/
├── clients/        # Outbound third-party calls. One file per external service.
└── config/
```

### Universal top-level files

| File | Rule |
| --- | --- |
| `README.md` | What it is, how to run it, in under a screen |
| `CLAUDE.md` | Repo conventions for AI sessions — points at the spec |
| `.env.example` | Every variable, empty values, committed. `.env` never is. |
| `docs/SPEC.md` | This document |
| Lockfile | Always committed |

---

## 2. Naming

### The rule behind the rules

**A name states what the thing is or does.** If choosing a name is hard, the thing does too many things — that's the finding, not the name.

Banned as class or module suffixes: `Manager`, `Helper`, `Util(s)`, `Handler` (outside an explicit handler layer), `Processor`, `Data`, `Info`, `Service` used as a shrug. Each means "I didn't decide what this is." `ScheduleValidator`, `ShiftRepository`, `PdfExporter` state a job.

### By kind

| Kind | Convention | Example |
| --- | --- | --- |
| Class / type / interface | PascalCase noun, no `I` prefix | `ShiftRepository`, `Conflict` |
| Function / method | camelCase (or snake_case per language) verb phrase | `detectConflicts`, `load_week` |
| Boolean | `is` / `has` / `can` / `should` prefix | `isActive`, `hasConflicts` |
| Constant | SCREAMING_SNAKE, module scope only | `MAX_WEEKLY_HOURS` |
| File — module | kebab-case, matching its main export | `shift-repository.ts` |
| File — UI component | PascalCase, matching the component | `ShiftGrid.tsx` |
| Test | beside the source | `shift-repository.test.ts` |
| DB table | snake_case, **plural** | `shifts`, `time_off` |
| DB column | snake_case, **singular** | `employee_id`, `start_minute` |
| Foreign key | `<entity>_id` | `employee_id` |
| Timestamp column | `*_at`, UTC | `created_at`, `archived_at` |
| Boolean column | `is_*` — never negated | `is_active`, never `is_not_deleted` |
| REST path | plural nouns, no verbs | `POST /shifts`, not `/createShift` |
| Event | `entity.past_tense` | `shift.created` |
| Env var | SCREAMING_SNAKE, prefixed | `APP_DB_PATH` |
| Branch | `type/short-description` | `feat/conflict-badges` |

### Abbreviations

Spell words out. The only accepted short forms are `id`, `url`, `api`, `db`, `http`, `ui`, and domain terms the users themselves say. `emp`, `sched`, `cfg`, `mgr` are not among them.

---

## 3. Size limits

These are **smoke detectors, not laws.** Crossing one means look, not necessarily split — a 400-line file of unrelated constants is fine; a 200-line function is not.

| Unit | Soft | Hard | What crossing it usually means |
| --- | --- | --- | --- |
| File | 300 lines | 500 | Two modules sharing a filename |
| Function | 40 lines | 80 | Sections that want to be functions — if you'd comment `// now validate`, that's the split |
| Class | 5 public methods | 10 | Two responsibilities |
| Parameters | 3 | 4 | Pass an options object; positional booleans are unreadable at the call site |
| Nesting depth | 3 | 4 | Invert with guard clauses and early return |
| Cyclomatic complexity | 10 | 15 | Branch table or polymorphism |
| React component | 150 lines JSX | 250 | Extract subcomponents, lift the data fetching out |
| Function args in a call chain | — | — | If you're threading a value through 3+ layers untouched, the layering is wrong |

Enforce what the linter can enforce (`max-lines`, `max-depth`, `complexity`, `max-params`) so it isn't a matter of opinion in review.

---

## 4. Dependency direction

State the allowed direction once, then it's mechanical:

```
routes/ui  →  services  →  domain  ←  db
                              ↑
                        (imports nothing)
```

- **`domain/` imports no framework.** No HTTP types, no ORM, no React. It must be testable with no app running. This single rule is what keeps business logic from dissolving into controllers.
- **`db/` depends on `domain/`, never the reverse.** Entities don't know they're persisted.
- **No circular imports.** Enforce with `madge --circular`, `import-linter`, or the language's own check.
- **Cross-feature imports go through the feature's public entry point only** — `features/scheduling` may import `features/employees`, but only what its index exports, never a file three levels in.
- **`lib/` knows nothing about the domain.** If a helper needs a `Shift`, it isn't a helper.

---

## 5. Error handling

- **One error type per boundary**, carrying a typed code — never match on message strings.
- **Never swallow.** An empty `catch` is a decision to lose information; if the error genuinely doesn't matter, say so in a comment.
- **Errors crossing a boundary get context added**, not just a rethrow: which record, which operation.
- **Client-facing errors are generic; logs carry the detail.** Stack traces in responses hand over internals.
- Pick one style per language and hold it: exceptions in Python/JS, `Result` in Rust, explicit returns in Go. Mixed styles mean every call site is a guess.
- **No `any`, no bare `except:`, no `unwrap()` outside tests.** Turn on strict mode (`tsconfig.strict`, `mypy --strict`, `clippy`) at project start — retrofitting it is a week nobody budgets.

## 6. Async

- Every call leaving the process has an explicit **timeout**. A missing timeout is a hang that propagates upward.
- **No floating promises** — lint it (`no-floating-promises`).
- Nothing that can block sits in a request path without a stated bound.

## 7. Comments and documentation

- Comment **why**, never what. `// increment i` is noise; `// vendor API 500s on empty arrays` is the reason a reader won't delete the guard.
- **No commented-out code.** Git remembers.
- Every `TODO` carries an owner or an issue link. An anonymous TODO is permanent.
- Public functions in a shared module get a docstring stating the contract — arguments, return, and what it throws.

## 8. Tooling — non-negotiable, decided once

Name these in the spec so nobody debates them in review:

| Concern | Named tool |
| --- | --- |
| Formatter | Prettier · ruff format · rustfmt · gofmt |
| Linter | ESLint · ruff · clippy · vet |
| Type checking | `strict: true` · `mypy --strict` |
| Pre-commit | format + lint on staged files |
| CI | format check, lint, typecheck, test — all blocking |

Formatting is never a review comment. The formatter wins; there is no style discussion.

## 9. Tests

- **Colocated** with the source, named for the unit under test.
- Name the behavior, not the method: `it('flags overlap when two shifts share an hour')` — a failure message that reads as a sentence tells you what broke without opening the file.
- **Must have tests:** business rules, authorization checks, data migrations, anything with arithmetic on dates or money.
- **Don't test:** getters, framework wiring, third-party libraries.
- One assertion concept per test. A test asserting six things reports one failure and hides five.
- Tests use real data structures, not mocks of your own code. Mock only what crosses the process boundary.
