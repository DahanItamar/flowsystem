<div align="center">

<samp>

## FlowSystem

**Two skills for Claude Code. One loop.**

Write a spec worth having. Keep it true.

</samp>

</div>

<br>

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

<br>

Claude writes vague code from vague prompts — not because the model is weak, but because *"build me a desktop app for shifts"* isn't a specification, and nobody has decided what the thing is yet.

So write the spec first. The catch is that a spec is only useful while it's **true**, and code drifts away from it in about a month. That's why this is two skills and not one.

<br>

### <samp>Install</samp>

**Terminal CLI**

```
/plugin marketplace add DahanItamar/flowsystem
/plugin install flowsystem@flowsystem
/reload-plugins
```

One install, both skills.

**VS Code extension** — the two lines above do nothing here. `/plugin` is an interactive panel the terminal CLI has and the extension doesn't; paste it and Claude answers *"`/plugin` isn't available in this environment"* without adding anything. The extension spells it **`/plugins`**, plural, and opens a dialog:

1. Type `/plugins` in the prompt box
2. **Marketplaces** tab → add `DahanItamar/flowsystem`
3. **Plugins** tab → find **flowsystem** → **Install**, and choose a scope
4. Restart Claude Code when the banner asks

Same plugins and marketplaces either way — the extension drives the same commands underneath, so anything you add here is there in the CLI too.

**Claude desktop app** — use the built-in plugin browser.

**Web, cloud sessions, or anywhere without a plugin UI** — drop the plugin into your personal skills directory. It ships its own `.claude-plugin/plugin.json`, so Claude Code discovers it in place as `flowsystem@skills-dir` on the next session, with no marketplace and no install step:

```bash
git clone https://github.com/DahanItamar/flowsystem.git
cp -r flowsystem/plugins/flowsystem ~/.claude/skills/flowsystem
```

```powershell
# Windows PowerShell
git clone https://github.com/DahanItamar/flowsystem.git
Copy-Item -Recurse flowsystem\plugins\flowsystem "$env:USERPROFILE\.claude\skills\flowsystem"
```

Restart Claude Code, or run `/reload-plugins`. The skills are namespaced identically either way, so everything below applies unchanged.

**Scripted, no prompts** — if you have the CLI but want it non-interactive:

```bash
claude plugin marketplace add DahanItamar/flowsystem
claude plugin install flowsystem@flowsystem
```

<br>

### <samp>The two skills</samp>

**`spec-architect`** — run once, at the start.

```
/flowsystem:spec-architect I want a desktop app for managing employee shifts
```

Reads your repo if there is one, asks three to five questions that actually change the architecture, then writes `docs/SPEC.md` — twelve sections covering architecture, conventions, data models, interfaces, edge cases, security, and build order. Everything it wasn't told, it decides and records as a numbered assumption you can reject.

**`spec-drift`** — run whenever you come back.

```
/flowsystem:spec-drift
```

Compares the code against the spec and reports every gap with a verdict: **regression** (the code broke a decision that had a reason) or **staleness** (the document is just behind). You pick a direction for each; it applies them.

> Both are namespaced by the plugin — including the skills-directory route above, since the manifest travels with it. The prefix only disappears if you copy a single skill folder on its own (`plugins/flowsystem/skills/spec-architect` → `~/.claude/skills/spec-architect`). With no manifest alongside it, that's a plain skill: `/spec-architect`.

<br>

### <samp>See it work</samp>

> ### [The loop, over five weeks →](examples/the-loop.md)
> A spec gets written. Three weeks later a one-line validation fix silently reverses it, and every test still passes. `spec-drift` catches it and explains which side is wrong.

Also here: a [full worked spec](examples/shift-planner-spec.md) from one sentence of input, and a [same-prompt comparison](examples/before-and-after.md) of building with and without one.

None of it is illustrative — the implementations are real files with a test suite that proves the difference:

```
node --test examples/proof/proof.test.mjs     13 tests, zero dependencies
```

<br>

### <samp>The rules they run on</samp>

**Never ask what you can decide.** A question earns its place only if two plausible answers produce two different systems. *"What should we call it?"* decides nothing. *"Does more than one person touch the same record?"* decides whether a server exists at all.

**Could this be deleted and the product still work?** If yes, delete it. No message queue, no cache layer, and no microservice boundary for something three people will use.

**A gap against a recorded reason is a regression until proven otherwise.** Updating the spec to match the code is the fast, dangerous default — do it wrongly once and the document now specifies the bug.

<br>

### <samp>Layout</samp>

```
plugins/flowsystem/skills/
├── spec-architect/        idea → spec
│   ├── SKILL.md
│   └── references/        decision rules · code conventions · template · risks
└── spec-drift/            spec ↔ code
    ├── SKILL.md
    └── references/        checkable claims · verdicts

examples/
├── the-loop.md            both skills, one project, five weeks
├── shift-planner-spec.md  full worked output
├── before-and-after.md    same prompt, with and without
└── proof/                 real implementations + runnable tests
```

<br>

<div align="center">
<samp>

MIT · [Itamar Dahan](https://github.com/DahanItamar)

</samp>
</div>
