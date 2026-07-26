# Decision Rules

The question bank, and the rules that turn answers into architecture.

---

## Part 1 — The question bank

Each entry states **what the answer decides**. If you already know the answer from the user's description or the codebase, do not ask it. If the answer wouldn't change your design, do not ask it.

### Q1 — Who uses it, and do they share data?

> One person on their own machine · a small known team · anyone who signs up

**Decides: whether a server exists at all.** This is the highest-leverage question in the bank; ask it first when it isn't obvious.

- One person, local data → no backend, no auth, no network layer. A local database and a UI.
- Known team, shared data → one server, one database, simple session auth.
- Public signup → tenancy model, registration, password reset, rate limiting, abuse handling. Roughly triple the scope. Make sure the user meant it.

### Q2 — What happens offline, or when the network drops mid-action?

> Doesn't matter · must keep reading · must keep writing

**Decides: whether you're building sync.** "Must keep writing" means local-first storage, an outbox, conflict resolution, and a merge policy — weeks of work with a long tail of bugs. Never assume it. Confirm the user actually wants it before writing it into the spec.

### Q3 — Do all users see the same things, or does it depend who they are?

> Everyone equal · owner vs. member · defined roles with different permissions

**Decides: the authorization model, and how deep it reaches.** Roles are not a UI concern — they reach into every query. Retrofitting them is one of the most expensive changes there is, so decide now even if the first version ships with one role.

### Q4 — Does anything have to happen without someone clicking?

> No · scheduled jobs · live push to connected clients

**Decides: whether you need a scheduler, a worker, or a socket layer.** Each is a separately deployed moving part. "Live push" specifically means WebSockets/SSE plus reconnection and replay logic — polling is often correct and always cheaper.

### Q5 — Money, personal data, or anything regulated?

> Neither · personal data · payments/health/finance

**Decides: audit trails, encryption at rest, retention policy, and whether a compliance section is required.** If payments: never store card data — a hosted checkout (Stripe Checkout, Paddle) keeps the system out of PCI scope entirely. State this explicitly in the spec.

### Q6 — Where does it have to run?

> Browser · desktop app · mobile · terminal · headless service

**Decides: platform capabilities and the distribution story.** Ask only if genuinely ambiguous. If the user says "desktop", follow up on why — filesystem access, offline, system tray, and OS integration are real reasons; "feels more professional" means a web app is probably the better answer, and worth saying so in one sentence.

### Q7 — Who builds it, and what is already committed?

> Solo · small team · existing stack in the repo
> **and:** anything already paid for, hosted, or mandated — a database, a host, a cloud account, a company policy

**Decides: stack selection, and how much explanation the spec carries.** Optimize for what the builder can maintain alone at 2am, not for what benchmarks best. A stack they know beats a stack that's marginally better.

**Ask the second half whenever the project needs hosting or a database.** What the builder *knows* and what the project is *already committed to* are different facts, and the second one silently overrules every derivation rule in Part 2. A spec that confidently picks managed Postgres on one provider, for someone already paying for another, is wrong in a way that looks authoritative — the reader assumes the choice was informed.

The answer is usually one sentence and often "nothing yet". Ask anyway; the cost of asking is far below the cost of a spec that quietly contradicts the user's existing bill.

### Q8 — Which languages, and is any of them right-to-left?

> One language · several, all left-to-right · includes Hebrew, Arabic, or Farsi

**Decides: layout direction, and whether supporting it is nearly free or a full rewrite.**

RTL costs almost nothing if the UI is built for it from the first commit — logical CSS properties (`margin-inline-start`, `padding-block`, `text-align: start`), `dir` set on the root, and no directional icons hardcoded. Retrofitting it means sweeping every `margin-left`, every `left: 0`, every chevron that points the wrong way, and every layout that assumed a reading order. It is one of the largest gaps between "decided on day one" and "decided in month three" in all of frontend work.

Ask whenever the project has a UI **and** the user's own language or target market isn't English. Skip it for CLIs, services, and anything headless.

A second language also decides whether user-facing strings live in a translation layer from the start or get hardcoded into components — the same retrofit problem, one layer up.

### Q9 — Realistically, how much data and how many concurrent users?

> Tens · thousands · millions

**Decides: whether any scaling concern belongs in the spec at all.** Below ~100k rows and ~100 concurrent users, SQLite on one box is genuinely correct and the spec should say so plainly. Do not design for a scale the user hasn't reached; do note the specific threshold at which the design would need revisiting.

---

## Part 2 — Derivation rules

Apply in order. Each rule's default holds unless a stated requirement overrides it.

### Storage

**An existing commitment wins.** If the project already has a database, a host that dictates one, or an account someone is already paying for (Q7), that is the answer — record it as the decision with "existing infrastructure" as the reason and skip the table. Only derive from scratch when nothing is committed yet.

| Situation | Default |
| --- | --- |
| Single user, local | SQLite (`better-sqlite3`, `sqlite3`, `sqlx`) |
| Shared, relational, < 100k rows | SQLite or Postgres — either is fine; pick Postgres if hosting already provides it |
| Shared, relational, growing or multi-writer | Postgres |
| Genuinely schemaless documents | Postgres with `jsonb` — still not MongoDB, and say why |
| Cache / queue | Nothing, until a measured problem exists |

Rules:

- **A file is a database.** Config, small lists, and single-user preferences do not need a DB. JSON on disk is a legitimate answer for a small tool.
- **Do not add Redis** without a named, measured problem it solves.
- **Migrations exist from day one.** Any schema that will outlive one deploy needs a migration tool named in the spec.

### Backend

- No shared data → **no backend.** Do not add an API to a single-user local app.
- Shared data → **one monolithic service.** Not microservices. The threshold for splitting is independent deploy cadence or independent scaling needs, neither of which a new project has.
- Read-heavy, mostly static content → consider static generation and skip the runtime entirely.
- Choose the framework the builder knows. If nothing is established: Node → Fastify or Hono; Python → FastAPI; Go → stdlib + chi.

### Frontend

- Content-first, SEO matters → SSR framework (Next.js, Nuxt, SvelteKit).
- App-behind-a-login → SPA (Vite + React/Svelte/Vue). Server rendering adds complexity that buys nothing behind auth.
- Desktop → **Tauri** if binary size and memory matter and the team can tolerate Rust at the edges; **Electron** if the team is JS-only or needs deep Node integration. State the tradeoff in one line.
- Terminal → pick a mature TUI library and specify it; don't hand-roll ANSI.
- **Any RTL language in scope** → logical CSS properties and `dir` on the root from the first commit, stated in §4 as a convention so it survives later sessions. This is the cheapest decision in the document to make and one of the most expensive to reverse.

### Communication between components

Name the mechanism and the payload shape for every boundary:

| Boundary | Mechanism |
| --- | --- |
| Browser ↔ server | REST + JSON, or tRPC/GraphQL when the client is typed and the team wants it |
| Desktop renderer ↔ main | IPC over a **narrow, allowlisted** channel set — never expose Node directly to the renderer |
| Server ↔ background job | A durable queue table in the existing DB before reaching for a broker |
| Server → client push | SSE for one-way, WebSockets only when the client must also push |
| Process ↔ process, same host | Unix socket or stdio, not a loopback HTTP port |

### Auth

- Local single-user → none. OS account is the auth boundary. Say so explicitly so nobody adds a login screen later.
- Team/public → session cookies (`httpOnly`, `secure`, `sameSite`) over JWT-in-localStorage. JWT only when there is a genuine cross-service or stateless requirement.
- Don't build password reset, email verification, and OAuth from scratch if a provider (Auth.js, Clerk, Supabase Auth) fits — but name the lock-in cost in one line.

### Data modeling

- Every entity gets: an id (specify the type — `uuid`, `nanoid`, autoincrement), `created_at`, and `updated_at` if mutable.
- **Nullability is a decision, not an oversight.** Every optional field states why it can be absent.
- Money is integer minor units plus an explicit currency code. Never a float.
- Timestamps are UTC with timezone; convert only at the display edge.
- Enums are enums — a constrained union type or DB enum, never a free string with a comment.
- Model the relationship cardinality explicitly (1:1, 1:N, M:N) and name the join table when it's M:N.
- Soft delete only when there's a stated recovery or audit requirement; otherwise delete, and say that data is unrecoverable.

### What to leave out

Unless the user stated a requirement that demands it, the spec must **not** contain: microservices, Kubernetes, GraphQL federation, event sourcing, CQRS, a service mesh, multi-region anything, a message broker, or a caching layer.

If one of these is genuinely warranted, the spec states the specific requirement that forced it. No justification, no entry.
