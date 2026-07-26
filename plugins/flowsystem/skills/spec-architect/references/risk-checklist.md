# Risk Checklist

Sweep the design against this before writing the Edge Cases and Security sections.

**Only surviving items go in the spec.** An item survives if it can actually happen in *this* system and the current design doesn't already handle it. A checklist copied wholesale into a document is noise, and noise is how the two items that mattered get skipped.

Each surviving item is written as: **trigger → consequence → handling.** Never just the trigger.

---

## Universal

- [ ] **Empty state.** Zero records, first launch, nothing configured. Frequently the least-designed and most-seen screen in the product.
- [ ] **The 10,000-row case.** What renders, what query, what index. Name the pagination strategy or state explicitly that the dataset is bounded and why.
- [ ] **Concurrent edit.** Two writers, same record. Last-write-wins is a legitimate answer — but it must be a stated answer, not a default nobody chose.
- [ ] **Interrupted write.** Power loss or crash mid-operation. Is the persisted state still valid? Anything spanning two tables needs a transaction; anything spanning two systems needs an idempotency key.
- [ ] **Duplicate submit.** Double-click, retry, refresh-on-POST. Every mutating operation needs a stated dedup story.
- [ ] **Clock and timezone.** DST transitions, users in different zones, dates that are dates rather than instants (a birthday has no timezone; a meeting does).
- [ ] **Unicode and length.** Emoji in names, RTL text, a 4000-character paste into a field sized for 40.
- [ ] **Migration of existing data.** Every schema change after v1 needs a path for rows that already exist.

## Input and validation

- [ ] Validation runs **server-side** — client validation is UX, never a control.
- [ ] One schema, one source of truth (Zod, Pydantic, JSON Schema) shared by both sides where the language allows.
- [ ] Numeric bounds, string lengths, and array sizes are all capped. An uncapped array is a memory exhaustion vector.
- [ ] Uploads: extension **and** content-type **and** magic bytes **and** a size cap. Stored outside the web root, served under a path that never reflects the user-supplied filename.

## Authorization — the highest-value section here

- [ ] **Every query is scoped by owner.** The single most common real-world vulnerability is an ID in a URL that no one checked belongs to the caller. Walk each endpoint and confirm it.
- [ ] Authorization is enforced **server-side per request**, not by hiding UI elements.
- [ ] Enumerable IDs: sequential integers leak volume and enable guessing. Choose deliberately.
- [ ] Privilege escalation: can a user edit their own role, or set a role during signup?
- [ ] Multi-tenant: is tenant isolation enforced in a single place (middleware, RLS, a repository layer), or re-implemented in every handler? The second option will leak eventually.

## Secrets and data handling

- [ ] No secrets in the repo. `.env` is gitignored, `.env.example` is committed with empty values.
- [ ] No secrets reachable by the client bundle — anything a browser can read is public.
- [ ] Passwords hashed with argon2id or bcrypt. Never a general-purpose hash, never encryption.
- [ ] Logs and error reports carry no PII, tokens, or full request bodies.
- [ ] Retention and deletion: what happens when a user asks to be deleted, and does that cascade correctly?

## Network-facing

- [ ] Rate limiting on auth endpoints and anything expensive.
- [ ] CORS is an explicit allowlist, never `*` alongside credentials.
- [ ] Errors returned to clients are generic; details go to server logs only. Stack traces in responses hand over the internals.
- [ ] Any URL the server fetches on a user's behalf is an SSRF vector — allowlist the destination.
- [ ] Dependencies pinned via a committed lockfile.

## Desktop apps

- [ ] IPC is an **explicit allowlist of named channels** with validated payloads. A generic "run this" channel hands the renderer full local execution.
- [ ] `contextIsolation: true`, `nodeIntegration: false` (Electron). Tauri: the allowlist is minimal and scoped.
- [ ] Any path from user input is resolved and confirmed to sit under an allowed root — `../../` traversal is the bug here.
- [ ] External links open in the system browser, never in an app window.
- [ ] Auto-update is signed, or absent. An unsigned update channel is remote code execution.
- [ ] Local data at rest: is it encrypted, and if not, is the spec explicit that it isn't?

## Background work and integrations

- [ ] Job failure: retry policy, backoff, max attempts, and where the corpse goes.
- [ ] Jobs are idempotent — they will run twice.
- [ ] Third-party API down, slow, or rate-limiting: timeout, retry, and the degraded behavior the user sees.
- [ ] Webhooks: signature verified, replay window enforced, handler idempotent.
- [ ] Every outbound call has a timeout. A missing timeout is a hang that propagates.

## Operations

- [ ] Backups: what, how often, and — the part that gets skipped — has a restore been tested?
- [ ] When something breaks in production, what does the operator look at? Name it.
- [ ] Config differences between dev and prod are enumerated and validated at startup, so a missing variable fails loudly on boot rather than quietly at 3am.
