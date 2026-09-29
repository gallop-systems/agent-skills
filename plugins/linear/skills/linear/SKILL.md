---
name: linear
description: Create, triage, and manage Linear issues at Gallop Systems following the team's workflow conventions — issue status, issue templates, and the project/milestone hierarchy. Use whenever the user asks for Linear work (creating or updating issues, placing work in projects and milestones) on a Gallop client.
---

# Linear — Gallop Team Workflow

## Linear Tooling — MCP First, `linear.mjs` as Fallback

**Default to the Linear MCP server (`mcp__linear__*` tools)** for all standard operations: creating/updating issues, listing projects/milestones/cycles/initiatives/labels/users, comments, etc. The MCP tools take strings directly — pass real markdown with real newlines, no JSON-escaping.

**Use `linear.mjs` only for things MCP doesn't expose:**
- `batch-move-to-milestone` — rate-limit-aware bulk moves
- `add-initiative-link` — adding external links to initiatives
- `api` — raw GraphQL escape hatch

For those, read [`cli.md`](cli.md) — it covers the CLI's one-time setup (workspace config, `LINEAR_API_KEY`) and every command's syntax.

**Verify every MCP write.** `mcp__linear__save_issue` has been seen returning success while silently not applying `labels` or the milestone — and its response echo can omit fields it did apply. After each create/update, re-read the issue with `mcp__linear__get_issue` and confirm labels, project, and milestone are all set. Pass UUIDs rather than names for those fields; if one still won't stick, set it with `linear.mjs api` (`issueUpdate` with `labelIds` / `projectMilestoneId`). Don't report the issue as done until it verifies.

**Write serially.** Linear can silently discard rapid-fire mutations while still reporting success. Make MCP writes one at a time — never in parallel — and verify as above.

### MCP setup check

This skill routes most operations through `mcp__linear__*` tools. Before doing any Linear work, verify the MCP server is available:

- **Not installed:** if no `mcp__linear__*` tools appear in your toolset, stop and tell the user: *"This skill needs Linear's MCP server. Install it with `claude mcp add --transport sse linear https://mcp.linear.app/sse`, restart Claude Code, then tell me to continue."* Don't try to fall back to `linear.mjs` for everything — the CLI only covers a small subset of operations.
- **Installed but not authorized:** if a `mcp__linear__*` call returns an auth/OAuth error, tell the user: *"The Linear MCP server is installed but not authorized. The next call will open a browser to sign in — please complete OAuth, then tell me to continue."*

Don't silently skip these checks. A user who hits an MCP error mid-task without context will be confused.

---

## Workflow Statuses

| Status | Meaning | Move here when |
|--------|---------|----------------|
| **Triage** | Raw incoming request, not yet shaped into a real issue | Client-portal submissions land here automatically — work them with the `linear-triage` skill |
| **Backlog** | Captured, being fleshed out, not yet ready for work | Default for every issue an agent creates |
| **Todo** | Fully fleshed out and ready for work | Only when the user says so — never on the agent's own judgement |
| **In Progress** | Actively being worked on | Work on it starts |
| **In Review** | Code complete, awaiting review or client feedback | A PR is open for review, or the change is waiting on client sign-off |
| **Done** | Shipped and verified | Merged/deployed and verified |
| **Canceled** | Dropped or no longer relevant | The work is no longer wanted |
| **Duplicate** | Same work as another issue | Another issue already covers it — mark it a duplicate of that issue rather than canceling |

---

## Priority Levels

| Priority | When to Use |
|----------|-------------|
| **Urgent** | Production issues, client-blocking bugs, deadline-critical items |
| **High** | Important client deliverables, work that should be picked up next |
| **Medium** | Planned work, non-blocking improvements |
| **Low** | Nice-to-haves, tech debt, internal tooling |

The MCP server and the CLI take priority as a number: `0` none, `1` Urgent, `2` High, `3` Medium, `4` Low.

---

## Labels

These are the labels that exist in the workspace — use only these; don't invent new ones. All are workspace-level, so every team has the same set with the same UUIDs.

### By Type (pick one)
- `Bug` — Something is broken
- `Feature` — New functionality
- `Improvement` — Enhancement to existing functionality
- `Tech Debt` — Maintenance, refactors, test/CI gaps, dependencies, config — work with no user-facing change
- `Discovery` — Research, investigation, or a decision to be made before building (what other teams call a spike)

### By Domain (apply every one the issue touches)
- `Frontend` — UI/UX, Vue components, pages, styling
- `Backend` — API handlers, server logic, integrations
- `DB` — Schema changes, migrations, data modeling

There is no `fullstack` label — an issue that touches several layers carries each of them (e.g. `Backend`, `Frontend`, `DB`).

### Status Flags (add alongside type + domain)
- `client-request` — Originated from the client (e.g. a client-portal submission) rather than from us
- `Needs Clarification` — Open questions for the client/requester must be answered before the work can be finished
- `agent blocked` — An AI agent working the issue hit something it can't resolve and needs a human

---

## Estimation (T-Shirt Sizes)

| Size | Value | Meaning | Rough Effort |
|------|-------|---------|-------------|
| **No estimate** | `null` | Not yet sized | — |
| **-** | `0` | Trivial — effectively no effort (a config flip, a copy change) | Minutes |
| **XS** | `1` | Tiny, obvious change | Under an hour or two |
| **S** | `2` | Small, well-understood task | A few hours |
| **M** | `3` | Medium complexity, clear scope | Half a day to a full day |
| **L** | `5` | Large, may span multiple days | 2–3 days |
| **XL** | `8` | Very large — consider breaking down | 3+ days, likely needs subtasks |

The MCP server and the CLI's `--estimate` both take the numeric **Value**, not the letter (e.g. `3` for M). If an issue is XL, break it into smaller sub-issues before starting work.

---

## Creating Issues

**Create in Backlog, then ask about Todo.** Every issue an agent creates goes to **Backlog** — don't assign a cycle. After creating it, show the user the issue (link plus a short summary) and ask whether it's ready for **Todo**; move it only if they say yes.

**Required placement rule:** Never create an issue without both a project and a milestone. **The project must already exist** — place the issue in the initiative's existing `M` project for the milestone it falls under, and never conjure a project to hold it (see "Never invent a project"). Creating a project is only correct for a confirmed out-of-scope revision. The milestones in an `M` project are the proposal's deliverables and are fixed too — place the issue in the deliverable it falls under; if none fits, say so and ask whether it's a revision rather than creating a milestone. Do not leave issues unscoped or unmilestoned.

**Work under a completed deliverable → ask.** If the work falls under a milestone that's already completed, don't place it silently and don't create a new milestone to dodge it. Tell the requester the deliverable is done and ask whether this is within its signed scope (place it in that milestone) or a revision (it goes to an `R` project).

**Check for duplicates first.** Before creating an issue, search the team's open and recently completed issues for the same or overlapping work. If one exists, show the user its title, status, assignee, and link, and ask whether to skip, update/comment on the existing issue, or create the new one anyway because the scope differs. Never silently create a duplicate.

**Closing a duplicate.** Comment on the duplicate explaining why and linking the original, then mark it with `duplicateOf` (MCP `save_issue`) — that moves it to the **Duplicate** status. Don't just cancel it.

**Fill in everything you can.** Set priority, estimate, one type label plus every domain label it touches (see **Labels**), and an assignee (see **Assignment Guidelines**) as a best-effort draft — the user adjusts them while fleshing the issue out.

**Confirm decisions with the requester — don't punt them into the issue.** When the person asking you to create the issue is right there in the conversation, ask the open decisions (scope, mechanism, data source, ownership, who/where it should land) *before* writing the issue — e.g. via a structured question prompt — and bake the confirmed answers into the body. Do **not** write an "Open questions" section full of decisions you could have just asked, and do **not** use that manufactured uncertainty as a rationale to leave fields blank or the issue unassigned. Only list something as an open question when the requester tells you it's an open question — never decide on your own that it needs a meeting, the client, or more investigation. Ask everything; whatever they answer becomes a confirmed decision, with the issue placed and assigned accordingly. Answers are folded into the issue body itself, not appended as a log of decisions — see "The body is the current spec" under **Issue Body Conventions**.

### Issue Dependencies

Use the MCP server for issue relations:
- **Add:** `mcp__linear__save_issue` with `blocks` / `blockedBy` (issue identifiers, e.g. `["ACME-12"]`). Append-only — existing relations are kept.
- **Remove:** `mcp__linear__save_issue` with `removeBlocks` / `removeBlockedBy`.
- **List:** `mcp__linear__get_issue` with `includeRelations: true` — returns `blocks`, `blockedBy`, `relatedTo`, and `duplicateOf`.

### Comments

Always use `@` mentions when referring to team members in comments. Use the Linear `@` mention syntax with the team member's display name from `workspace.json`'s `roles` (e.g., `@<Frontend Lead Name>`, `@<Backend Lead Name>`) so they get properly notified.

---

## Writing Issues

> **Tech stack context:** All projects use Nuxt 4 + Nitro + Kysely + PostgreSQL + PrimeVue/Volt + Tailwind CSS v4. See `tech-stack.md` for full details.

Read the examples before writing an issue — they show the voice and level of detail better than any rule:

- [backend-feature.md](./examples/backend-feature.md) - Backend feature: behavior, business rules, explicit out-of-scope
- [backend-data-model.md](./examples/backend-data-model.md) - Data-model change described as rules, not columns
- [frontend-feature.md](./examples/frontend-feature.md) - Frontend feature with repo-verified UI Notes
- [small-improvement.md](./examples/small-improvement.md) - A small change kept small
- [discovery.md](./examples/discovery.md) - An open question with options and trade-offs
- [bug.md](./examples/bug.md) - Bug with a code-grounded root cause
- [right-and-wrong.md](./examples/right-and-wrong.md) - ❌/✅ pairs for the mistakes agents make most

### Voice

- **Frame around intent, not the solution.** Open with whose problem this is and what they're trying to get done. The framing never describes the fix — that's what the rest of the issue is for.
- **Write like a person.** Plain words, the way you'd explain it to a teammate — "we", "right now", contractions are fine. Avoid abstract, stiff phrasing like "technicians stop being entities a visit points at"; say "instead of linking a visit to a technician record, the visit stores the name".
- **Never make up the reason.** The intent comes from the requester. If they didn't say why, ask them — don't guess, and don't pad it with benefits nobody mentioned ("will improve customer satisfaction").
- **Terse.** A short framing, then the substance. No paragraphs of background.
- **Behavior and rules, not implementation.** State what has to be true, the business rules, and the edge cases. For backend work never prescribe tables, columns, types, indexes, constraints, endpoint shapes, or enum values — the Backend lead designs those. Naming *existing* code is fine.
- **Grounded in `main`.** Describe what the code does today, verified in the repo. Never point at a wireframe branch or scratch file (paste the substance instead), and never frame an issue around another issue's plan.
- **Explicit scope.** Say what's out of scope and whether existing data is converted ("Greenfield: no conversion of existing …").

### Titles

A plain, sentence-case statement of the outcome — "Send a quote by email from the platform", "Invoices list ignores credits in the total". **No prefixes of any kind**: no client key, no domain (`UI:`, `API:`), no `Fix:` / `Chore:` / `Spike:`. The team identifies the client; labels carry type and domain.

### Body layout

1. **Doc header** — if the project has its project docs (see the `project-docs` skill) ("Our thinking", "How they operate"), always open with a line linking the sections this issue relies on, then `---`:
   `**Context:** [Our thinking — <section>](url) · [How they operate — <section>](url)`
   Attach the same links to the issue (`links` on `save_issue`).
2. **`## Context`** — a few sentences on the intent: who's affected, what they're trying to do, and what gets in their way today. Not the solution.
3. **The type's sections** (below).
4. **`## Acceptance criteria`** — checkboxes describing observable outcomes; end with `Tests written` for any code work.

| Type | Sections after Context |
|------|------------------------|
| **Backend** (incl. data model) | `## Functionality` — bullets of behavior, rules, edge cases, out-of-scope |
| **Frontend** | `## Requirements` (checkboxes) · `## UI Notes` — repo-verified pages/components, Volt components, "Follow DESIGN_LANGUAGE.md". If the repo can't be checked, leave paths out — no "To Determine" / TBD section. |
| **Bug** | `## Bug` (what happens vs. what should) · `## Root cause` · `## Steps to reproduce` · `## Likely location` — replaces Context |
| **Discovery** | `## Open question` — the options, each with its trade-off. AC: settled with the client, recorded in "Our thinking", dependent issues updated. |
| **Tech Debt** | `## Requirements` · optional `## Files affected` |

### Links

- Link an issue **inline, by identifier, where the body first mentions the thing it owns** (`…the scheduler warns when they don't match (KEY-92)…`) — once per target.
- Never narrate lineage or dependencies ("upstream capture lives in KEY-14…") — that's what relations are for.
- Any project, issue, or doc named in the body is a clickable link.

### Body Conventions

- **Do NOT list or link an issue's sub-issues in the parent body** (no "Sub-issues" section, no bulleted child links). Linear renders an issue's children natively — a manual list just clutters the description and goes stale as children are added or removed. A parent body should carry the objective, any single-source-of-truth pointer, and acceptance criteria — nothing that restates the hierarchy.
- **No timestamped or dated section headers** (e.g. `## Data model — corrected (2025-05-01)`). State the current spec cleanly; issue history already records the "when." Dated "correction" sections accumulate as noise.
- **The body is the current spec, not a decision log.** When a clarifying answer or any later change alters the issue, rewrite the affected parts of the body so it reads as if it had always said that. Don't append a "Decisions" / "Clarifications" / "Update" section, and don't leave superseded text in place (struck through or otherwise) — anything superseded gets rewritten or removed.

### Fullstack Features — Split Into Separate Issues

When a feature requires both backend and frontend work, **always create separate issues** — one for backend and one for frontend. Link them using **Linear's dependency system** so the frontend issue is blocked by the backend issue.

> **Reminder:** For the frontend issue, verify affected pages/components from the client's repo. Don't guess file paths — check `app/pages/` and `app/components/` in the actual codebase.

This keeps issues focused, enables parallel assignment (the Backend lead on backend, the Frontend/PM lead on frontend), and makes progress tracking clearer. Using Linear dependencies (rather than just mentioning the dependency in the description) makes the blocking relationship visible in the UI, prevents the frontend issue from accidentally being started too early, and keeps the dependency machine-readable.

**Steps:**
1. Create the **backend issue** using the **Backend** layout (labels: `Feature`, `Backend`, plus `DB` if it changes the schema)
2. Create the **frontend issue** using the **Frontend** layout (labels: `Feature`, `Frontend`)
3. **Create the Linear dependency:** update the frontend issue with `mcp__linear__save_issue` `blockedBy: ["<backend issue identifier>"]` (or pass it on create), so the backend issue blocks the frontend issue

**Example:** "Add admin button to complete all job tasks"
- **Backend issue:** Support marking all tasks for a job as complete in a single operation; admin-only, should be atomic
- **Frontend issue:** Admin-only button on job page, confirmation dialog, API call, toast
- **Dependency:** frontend issue `blockedBy` the backend issue

> **Note:** If the feature is simple enough that the backend is trivial (e.g., a single straightforward CRUD endpoint), it's acceptable to create one combined issue assigned to the person doing both. Use your judgement.

---

## Assignment Guidelines

Issues are assigned by role: the **Frontend/PM lead** or the **Backend lead**. The CLI's `init` binds each role to a Linear member in `~/.config/linctl/workspace.json` — read it to know who they are.

| Issue Type | Default Assignee |
|-----------|-----------------|
| Kysely migrations, schema design, complex DB queries | Backend lead |
| Complex Nitro API handlers (transactions, multi-table) | Backend lead |
| Vue pages, Volt components, Tailwind styling, UX | Frontend/PM lead |
| Simple CRUD API endpoint (single table, straightforward) | Either (Frontend/PM lead can handle) |
| Client requirement gathering, design | Frontend/PM lead |
| Bug — Kysely/DB/server middleware | Backend lead |
| Bug — Vue/PrimeVue/Tailwind/client-side | Frontend/PM lead |
| Bug — fullstack | Discuss, assign based on root cause |

---

## Post-Organization: Update Initiative in Linear

**After organizing issues for a client (creating, triaging, or updating statuses), always update the corresponding initiative's `content` field in Linear.**

### What to Update

The initiative `content` field stores **client-level context only** — NOT data already tracked elsewhere in Linear. Update:

1. **Overview** — Client description, domain context, business purpose
2. **Repo structure** — Routes, components, API endpoints, key files
3. **Tech stack deviations** — Anything different from the standard Gallop template
4. **Domain concepts** — Key entities and business logic specific to the client
5. **Notes** — High-level observations, architectural decisions, gotchas

**Do NOT put in initiative content:** Team members (already in Linear), repo links (use `add-initiative-link` instead), project listings, milestone details, issue counts, progress percentages, remaining work, or any data already tracked in Linear's project/milestone/issue hierarchy.

### When to Update

- After creating a batch of new issues for a client
- After triaging/re-prioritizing a client's backlog
- After marking significant issues as Done or Canceled
- Any time the initiative's content would be stale after your changes

### How to Get Current Data

Read the initiative with `mcp__linear__get_initiative` and the client's issues with `mcp__linear__list_issues`, then write the new content with `mcp__linear__save_initiative`. Repo links go on the initiative via the CLI's `add-initiative-link` (see `cli.md`).

---

## Project & Milestone Hierarchy

Linear organizes work in a top-down hierarchy: **Initiative → Project → Milestone → Issue**. Here's how the Gallop team uses each level.

### Initiative (= Signed Proposal)

An **Initiative** represents **one signed proposal** for a client, not the client itself. A client who signs a second proposal (a later phase, a separate engagement) gets a **second initiative** — never a second set of projects bolted onto the first. The initiative's scope is fixed by what was signed.

**The current roster is not stored in this repo — fetch it live from Linear.** Initiatives are the source of truth for which engagements exist, their descriptions, and their repo links:

- **List all clients:** `mcp__linear__list_initiatives`
- **Read a client's full details (overview, repo structure, domain notes):** `mcp__linear__get_initiative` — these live in the initiative's `content` field
- **Get a client's repo URL:** read the `links` array on the initiative

When you start any task that needs client context, query Linear instead of looking for a hardcoded list. This keeps the skill in sync as clients are added or removed without repo changes.

- One initiative can contain **multiple projects**

### Project (= One Proposed Milestone, or a Revision)

A **Project** is **one of the milestones the signed proposal committed to** — not a
product, not a workstream, not a theme you invented. The initiative's project list
*is* the proposal's milestone list: if the proposal promised three milestones, the
initiative has three projects, numbered and named after them.

**Naming convention:** `[KEY] M<n> — <Milestone name>`, where `<n>` is the
milestone's number in the signed proposal.

- `[KEY] M1 — Data Model`
- `[KEY] M2 — Pricing Engine`
- `[KEY] M3 — Reporting`

**Work outside the signed scope is a revision, and gets its own project** —
attached to the **same initiative**, named with an `R` prefix instead of `M`:

- `[KEY] R1 — <Name>`, `[KEY] R2 — <Name>`, …

`R` numbering is sequential across the whole proposal in the order revisions are
taken on, independent of which milestone the revision relates to. Never fold
out-of-scope work into an `M` project — that silently rewrites what was signed.

#### Never invent a project

**The default is that the right project already exists.** Creating one is a
structural change to a signed engagement, so it is never a side effect of intake.

Before placing any work, answer this question — and **ask the requester if they
are in the conversation, do not infer it**:

> Is this within the signed scope, or is it a revision?

- **Within scope** → **find the existing `M` project yourself.** List the
  initiative's projects (`get_initiative` with `includeProjects: true`), read what
  each milestone covers, and place the work in the one it falls under. Only ask
  which project if two genuinely both fit. Do **not** create a project because none
  of the names happens to match the request's wording — milestone names are broad
  by design.
- **A revision** → determine the next `R<n>` (one past the highest existing `R`,
  or `R1`), **confirm the name and the revision framing with the requester**, then
  create it under the same initiative.

Never create a project to hold work you were unsure how to place, to mirror a repo
or deployment, to group work by theme or domain (that is what milestones and labels
are for), or because the initiative looked empty. If you cannot place the work and
the requester is unavailable, leave it unplaced and say so — an invented project is
harder to undo than an unplaced issue.

### Milestone (= One Proposed Deliverable)

A **Milestone** is **one deliverable the proposal listed under that project's milestone** — the same alignment as projects, one level down. An `M` project's milestones *are* its signed deliverables, so they're fixed by the proposal just like the project row.

- **In an `M` project, never create a milestone during intake.** Place the work in the deliverable it falls under. If none fits, that's a signal the work may be out of scope — say so and ask whether it's a revision.
- **In a confirmed `R` project**, you may create milestones for the revision's deliverables as part of intake.

**Examples within `[KEY] M2 — Billing`:**
- `Core Billing` — create, edit, send invoices (done)
- `Quotes` — quote workflow, create/edit/convert to invoice
- `Payments` — payment methods, receipts, balance due display

**Naming convention:** The deliverable's name from the proposal (no client key prefix needed since milestones live inside a project).

### Issue (= Task)

Individual work items live at the bottom of the hierarchy. Every issue belongs to a project and a milestone.

### Hierarchy in Practice

```
Initiative: <Client> — Phase 1        ← one signed proposal
  ├── Project: [KEY] M1 — Scheduling      ← proposal milestone 1
  │     ├── Milestone: Providers Module   ← proposal deliverable
  │     │     ├── KEY-101: Create providers list page
  │     │     ├── KEY-102: Add provider create/edit form
  │     │     └── KEY-103: Provider deactivation support
  │     ├── Milestone: Booking Requests
  │     │     ├── KEY-110: Request creation form
  │     │     └── KEY-111: Accept/reject API endpoints
  │     └── Milestone: Notifications
  │           └── KEY-120: Set up email service
  ├── Project: [KEY] M2 — Billing         ← proposal milestone 2
  └── Project: [KEY] R1 — SSO Integration ← out-of-scope revision
```

The project row is fixed by the proposal (`M1`, `M2`) plus whatever revisions have
been agreed (`R1`). New requests land as **issues in an existing deliverable milestone** inside an
existing project — projects and milestones only grow when a revision is confirmed.

### Guidelines for the Team

1. **Every new issue starts in Backlog, with no cycle.** Ask the user whether it's ready for Todo, and move it only on a yes (see "Create in Backlog, then ask about Todo").
2. **Every issue must belong to a project and a milestone.** Never create orphan issues and never leave an issue outside a milestone.
3. **Place the issue in an existing project — never invent one.** The initiative's `M` projects are the signed proposal's milestones; find the one the work falls under. A new project is correct *only* for work the requester confirmed is out of scope, and then only as the next `[KEY] R<n> — <Name>` revision project (see "Never invent a project"). Don't park work in a generic team backlog either — if you truly cannot place it, say so rather than manufacturing a home for it.
4. **Place the issue in the deliverable milestone it falls under.** Never create a milestone in an `M` project; only a confirmed `R` project may get new milestones during intake. If the matching milestone is completed, ask the requester whether the work is in scope or a revision (see "Work under a completed deliverable → ask").
5. **Use milestones for sequencing.** Milestones can have target dates, making them useful for communicating delivery phases to clients.
6. **Track progress in Linear.** After creating/updating projects or milestones, update the initiative's content in Linear to reflect the current structure (see "Post-Organization: Update Initiative in Linear").

---

## Contributing Back

This skill grows by capturing what it missed. If you just worked through something in this domain that this skill did not cover — an error you had to figure out, a behavior that contradicts what is documented above, a workflow knot — ask the user: **"Want me to contribute this back to the linear skill?"**

If yes, run `/contribute-skill`. If that command is not available, do the equivalent inline: distill the generic lesson (placeholders only — no project names, IDs, domains, or secrets), then branch or fork [gallop-systems/agent-skills](https://github.com/gallop-systems/agent-skills) and open a PR editing this skill.
