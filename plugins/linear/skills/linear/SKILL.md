---
name: linear
description: Create, triage, and manage Linear issues at Gallop Systems following the team's workflow conventions — issue status, issue templates, and the project/milestone hierarchy. Use whenever the user asks for Linear work (creating or updating issues, placing work in projects and milestones) on a Gallop client.
---

# Linear Project Management — Team Workflow & CLI Guide

## The CLI

The fallback tooling is a single zero-dependency Node script, `bin/linear.mjs`. It runs on bare `node` (v18.3+ — no `npm install`, no `tsx`, no build step) and uses symbolic names instead of raw UUIDs (`--state backlog`, `--assignee frontend`, `--labels bug,frontend`).

Invoke it as `node <skill>/bin/linear.mjs <command> [args] [--flags]`. Examples below write `node linear.mjs` for brevity — use the full path to the file, or `cd` into the skill's `bin/` directory first. Run `node linear.mjs help` for the full command list.

## First-time Setup (run once per user)

### Check 1 — Workspace bootstrap config exists

Before running any `linear.mjs` command, verify that the per-user workspace config exists at `~/.config/linctl/workspace.json` (override path with `$LINCTL_WORKSPACE_FILE`). This file holds **every team** in the workspace (each with its own UUID plus its workflow-state and label UUIDs — states differ per team), an optional `defaultTeam`, and the Linear member UUIDs that play the Frontend/PM and Backend roles. Without it, every command that needs the team, members, states, or labels will refuse to run.

> **Multi-team workspaces:** `workspace.json` registers all teams, but `states`/`labels` are per-team (each team's `Todo` is a distinct UUID). Which team a command targets is resolved in this order: the **`--team <key|name|uuid>`** flag → the **`LINCTL_DEFAULT_TEAM`** env var (a per-repo default — set it via direnv/`.envrc` or your shell so every command in a repo targets that team) → the **`defaultTeam`** field in `workspace.json`. If none resolve, `--team` is **required** on team-scoped commands; workspace-wide commands (e.g. `list-initiatives`) work without a team. A legacy config (predating per-team support, i.e. with no `defaultTeam` key and top-level `states`/`labels`) still works — it falls back to the first registered team — but re-run `init` to migrate it to the per-team schema.

```bash
[ -f "${LINCTL_WORKSPACE_FILE:-$HOME/.config/linctl/workspace.json}" ] && echo "ok" || echo "missing"
```

**If missing,** instruct the user to run:

```bash
node linear.mjs init
```

`init` calls Linear's GraphQL API, lists the workspace's members, and prompts the user to designate (1) the Frontend/PM lead and (2) the Backend lead by number, then (3) an optional default team key (blank = no default, so `--team` is required on each team-scoped call). It registers **all** teams with their per-team states/labels and writes `~/.config/linctl/workspace.json`. The config is read fresh on every invocation — no re-sourcing needed.

### Check 2 — Linear MCP server installed and authorized

This skill routes most operations through `mcp__linear-server__*` tools. Before doing any Linear work, verify the MCP server is available:

- **Not installed:** if no `mcp__linear-server__*` tools appear in your toolset, stop and tell the user: *"This skill needs Linear's MCP server. Install it with `claude mcp add --transport sse linear https://mcp.linear.app/sse`, restart Claude Code, then tell me to continue."* Don't try to fall back to `linear.mjs` for everything — the CLI only covers a small subset of operations.
- **Installed but not authorized:** if a `mcp__linear-server__*` call returns an auth/OAuth error, tell the user: *"The Linear MCP server is installed but not authorized. The next call will open a browser to sign in — please complete OAuth, then tell me to continue."*

Don't silently skip these checks. A user who hits an MCP error mid-task without context will be confused.

### Check 3 — `LINEAR_API_KEY` for the CLI

`linear.mjs` reads `LINEAR_API_KEY` from the environment. Before using any command, check whether it's set:

```bash
[ -n "$LINEAR_API_KEY" ] && echo "set" || echo "missing"
```

**If missing, onboard the user:**

1. Tell them: *"I need a Linear personal API key to run the CLI. Create one at https://linear.app/settings/account/security (click 'New API key', name it 'Claude Code', copy the `lin_api_...` token), then paste it here in chat."*
2. When they paste the key, install it into `~/.zshenv` so every future shell — including the ones Claude Code spawns — picks it up automatically:
   ```bash
   echo 'export LINEAR_API_KEY=lin_api_THEIR_KEY_HERE' >> ~/.zshenv
   ```
   (Use `~/.bashrc` instead if the user is on bash.)
3. Export it in the current shell too so the next tool call works without restart:
   ```bash
   export LINEAR_API_KEY=lin_api_THEIR_KEY_HERE
   ```
4. Verify with a harmless call: `node linear.mjs list-members`.

**Never commit the key, never write it into `.env` or any project file** — `~/.zshenv` is the single source of truth.

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

The API, the MCP server, and `linear.mjs --estimate` all take the numeric **Value**, not the letter (e.g. `--estimate 3` for M). If an issue is XL, break it into smaller sub-issues before starting work.

---

## Linear Tooling — MCP First, `linear.mjs` as Fallback

**Default to the Linear MCP server (`mcp__linear__*` tools)** for all standard operations: creating/updating issues, listing projects/milestones/cycles/initiatives/labels/users, comments, etc. The MCP tools take strings directly — pass real markdown with real newlines, no JSON-escaping.

**Use `linear.mjs` only for things MCP doesn't expose:**
- `batch-move-to-milestone` — rate-limit-aware bulk moves
- `add-initiative-link` — adding external links to initiatives
- `api` — raw GraphQL escape hatch

**Verify every MCP write.** `mcp__linear__save_issue` has been seen returning success while silently not applying `labels` or the milestone — and its response echo can omit fields it did apply. After each create/update, re-read the issue with `mcp__linear__get_issue` and confirm labels, project, and milestone are all set. Pass UUIDs rather than names for those fields; if one still won't stick, set it with `linear.mjs api` (`issueUpdate` with `labelIds` / `projectMilestoneId`). Don't report the issue as done until it verifies.

### The CLI

`bin/linear.mjs` wraps the Linear GraphQL API. It runs on bare `node` (v18.3+, no install) and reads `LINEAR_API_KEY` from the environment plus the workspace config from `~/.config/linctl/workspace.json`. There is nothing to source — every invocation loads config fresh.

```bash
node linear.mjs help        # full command list
```

### Symbolic names (no UUIDs needed)

The CLI resolves friendly names against `workspace.json`, so you rarely need raw UUIDs:

```
--team       ACME | "Acme Corp"  (team key or name)                          (or a UUID)
--state      todo | backlog | "in progress" | "in review" | done | canceled   (or a UUID)
--assignee   frontend | backend                                               (or a UUID)
--labels     bug,frontend,feature  (comma-separated label names)              (or UUIDs)
--priority   0-4  or  none | urgent | high | medium | low
```

`--team` selects which team a team-scoped command runs against, and `--state`/`--labels` then resolve against **that team's** states and labels. When `--team` is omitted it falls back to `$LINCTL_DEFAULT_TEAM` (a per-repo default) and then to `workspace.json`'s `defaultTeam`; if none are set you'll get an error listing the registered team keys. Workspace-wide commands (initiatives) don't need a team. Any value that's already a UUID is passed through untouched. Label names match case-insensitively with `-` and space interchangeable (`tech-debt` → `Tech Debt`), but `init` only registers the type and domain labels (`discovery`, `tech-debt`, `bug`, `feature`, `improvement`, `frontend`, `backend`, `db`) — apply the status flags (`client-request`, `Needs Clarification`, `agent blocked`) via the MCP server or by UUID. Project and milestone IDs are still UUIDs (pass them with `--project` / `--milestone`).

### Creating Issues

> **Create in Backlog, then ask about Todo.** Every issue an agent creates goes to **Backlog** — don't assign a cycle. After creating it, show the user the issue (link plus a short summary) and ask whether it's ready for **Todo**; move it only if they say yes.
>
> **Required placement rule:** Never create an issue without both `--project` and `--milestone`. **The project must already exist** — place the issue in the initiative's existing `M` project for the milestone it falls under, and never conjure a project to hold it (see "Never invent a project"). Creating a project is only correct for a confirmed out-of-scope revision. The milestones in an `M` project are the proposal's deliverables and are fixed too — place the issue in the deliverable it falls under; if none fits, say so and ask whether it's a revision rather than creating a milestone. Do not leave issues unscoped or unmilestoned.
>
> **Work under a completed deliverable → ask.** If the work falls under a milestone that's already completed, don't place it silently and don't create a new milestone to dodge it. Tell the requester the deliverable is done and ask whether this is within its signed scope (place it in that milestone) or a revision (it goes to an `R` project).
>
> **Check for duplicates first.** Before creating an issue, search the team's open and recently completed issues for the same or overlapping work. If one exists, show the user its title, status, assignee, and link, and ask whether to skip, update/comment on the existing issue, or create the new one anyway because the scope differs. Never silently create a duplicate.
>
> **Closing a duplicate.** Comment on the duplicate explaining why and linking the original, then mark it with `duplicateOf` (MCP `save_issue`) — that moves it to the **Duplicate** status. Don't just cancel it.
>
> **Fill in everything you can.** Set priority, estimate, one type label plus every domain label it touches (see **Labels**), and an assignee (see **Assignment Guidelines**) as a best-effort draft — the user adjusts them while fleshing the issue out.
>
> **Confirm decisions with the requester — don't punt them into the issue.** When the person asking you to create the issue is right there in the conversation, ask the open decisions (scope, mechanism, data source, ownership, who/where it should land) *before* writing the issue — e.g. via a structured question prompt — and bake the confirmed answers into the body. Do **not** write an "Open questions" section full of decisions you could have just asked, and do **not** use that manufactured uncertainty as a rationale to leave fields blank or the issue unassigned. Only genuinely external unknowns (something that needs a meeting, a client, or a spike to resolve) belong as open questions; everything the requester can answer on the spot should already be a confirmed decision with the issue placed and assigned accordingly.

```bash
# --project and --milestone are always required
node linear.mjs create-issue \
  --title 'Add user profile page' \
  --description 'Create /profile page with user info and settings' \
  --priority high \
  --state backlog \
  --assignee frontend \
  --labels feature,frontend \
  --estimate 3 \
  --project 'project-uuid-here' \
  --milestone 'milestone-uuid-here'

# Create a bug report
node linear.mjs create-issue \
  --title 'Fix: login redirect fails on Safari' \
  --description 'Users on Safari not redirected after login. Reproduced on Safari 17.' \
  --priority urgent \
  --state backlog \
  --assignee frontend \
  --labels bug,frontend \
  --project 'project-uuid-here' \
  --milestone 'milestone-uuid-here'

# Long descriptions: pass a file instead of inline text (no shell-escaping)
node linear.mjs create-issue --title 'Investigate perf issue' --state backlog \
  --description-file ./issue-body.md \
  --project 'project-uuid' --milestone 'milestone-uuid'

# Find the existing M project for the milestone this work falls under — do not create one.
# (Prefer the MCP `get_initiative` with includeProjects; this lists them via the CLI.)
node linear.mjs list-projects            # copy the [KEY] M<n> project's UUID
PROJECT_ID='project-uuid-here'
# Find the deliverable milestone the work falls under — do not create one in an M project.
node linear.mjs list-milestones "$PROJECT_ID"   # copy the milestone's UUID
MILESTONE_ID='milestone-uuid-here'
node linear.mjs create-issue --title 'Investigate performance issue' --state backlog \
  --project "$PROJECT_ID" --milestone "$MILESTONE_ID"
```

### Priority Values
- `0` = No priority
- `1` = Urgent
- `2` = High
- `3` = Medium
- `4` = Low

### Listing & Filtering Issues
```bash
# List all issues (pretty table by default)
node linear.mjs list-issues

# Filter by state type: backlog, unstarted, started, completed, canceled
node linear.mjs list-issues started

# Raw JSON output (for piping) — add --json to any list command
node linear.mjs list-issues --json
node linear.mjs list-issues started --json
```

### Updating Issues
```bash
# Move issue by status name
node linear.mjs move-issue "issue-uuid" "In Progress"
node linear.mjs move-issue "issue-uuid" "Done"

# Assign to a team member by role
node linear.mjs assign-issue "issue-uuid" frontend
node linear.mjs assign-issue "issue-uuid" backend

# General update — symbolic flags
node linear.mjs update-issue "issue-uuid" --priority urgent --state todo

# Or merge arbitrary raw JSON input with --raw
node linear.mjs update-issue "issue-uuid" --raw '{"priority":1}'
```

### Issue Dependencies

Use the MCP server for issue relations:
- **Add:** `mcp__linear__save_issue` with `blocks` / `blockedBy` (issue identifiers, e.g. `["ACME-12"]`). Append-only — existing relations are kept.
- **Remove:** `mcp__linear__save_issue` with `removeBlocks` / `removeBlockedBy`.
- **List:** `mcp__linear__get_issue` with `includeRelations: true` — returns `blocks`, `blockedBy`, `relatedTo`, and `duplicateOf`.

The CLI's `add-dependency` / `list-dependencies` / `remove-dependency` still work as a fallback.

### Comments
```bash
# Add a comment to an issue
node linear.mjs add-comment "$ISSUE_ID" --body "Comment body text here"

# Long comment from a file (no shell-escaping)
node linear.mjs add-comment "$ISSUE_ID" --body-file ./comment.md
```

> **Note:** Always use `@` mentions when referring to team members in comments. Use the Linear `@` mention syntax with the team member's display name from `workspace.json`'s `roles` (e.g., `@<Frontend Lead Name>`, `@<Backend Lead Name>`) so they get properly notified.

### Searching
```bash
node linear.mjs search-issues "login bug"
```

### Projects & Milestones
```bash
# Create a new project (linked to an initiative)
# Projects mirror the signed proposal's milestones ([KEY] M<n>) or a confirmed revision ([KEY] R<n>).
# Never create one to hold work you couldn't place — see "Never invent a project".
node linear.mjs create-project --name "[KEY] M1 — Milestone Name" --initiative "$INITIATIVE_ID" --description "Short description"

# List all projects (pretty table with initiative, state, progress)
node linear.mjs list-projects

# List milestones within a project
node linear.mjs list-milestones "$PROJECT_ID"

# List issues grouped by milestone within a project
node linear.mjs list-project-issues "$PROJECT_ID"

# Raw JSON variants (for piping) — add --json
node linear.mjs list-projects --json
node linear.mjs list-milestones "$PROJECT_ID" --json
node linear.mjs list-project-issues "$PROJECT_ID" --limit 200 --json

# Create issue within a project/milestone
node linear.mjs create-issue \
  --title 'Add feature X' \
  --project 'project-uuid' \
  --milestone 'milestone-uuid' \
  --priority high \
  --assignee frontend \
  --labels feature
```

### Initiatives
```bash
# Create a new initiative (= a newly signed proposal; a repeat client gets another one)
node linear.mjs create-initiative --name "ClientName" --description "Short description"

# List all initiatives (pretty table with ID, status, description)
node linear.mjs list-initiatives

# Get full initiative detail by name (case-insensitive)
node linear.mjs get-initiative-by-name "Northwind"

# Get full initiative detail by ID
node linear.mjs get-initiative "$INITIATIVE_ID"

# Update initiative content (markdown) or description
node linear.mjs update-initiative "$INITIATIVE_ID" --content-file ./initiative-notes.md
node linear.mjs update-initiative "$INITIATIVE_ID" --description "Short description"

# Add an external link (e.g., repo) as a resource on the initiative
node linear.mjs add-initiative-link "$INITIATIVE_ID" "https://github.com/org/repo" "GitHub Repo"

# Raw JSON of all initiatives
node linear.mjs list-initiatives --json
```

### Info Commands
```bash
node linear.mjs list-states        # Workflow states
node linear.mjs list-members       # Team members
node linear.mjs list-labels        # Labels
```

---

## Issue Templates

> **Tech stack context:** All projects use Nuxt 4 + Nitro + Kysely + PostgreSQL + PrimeVue/Volt + Tailwind CSS v4. See `tech-stack.md` for full details.

### Issue Title Conventions

- **No client prefix** (e.g., ~~[GBX]~~) — the team already identifies the client.
- **No domain prefix** (e.g., ~~UI:~~, ~~API:~~) — labels (`frontend`, `backend`) already cover this.
- Titles should be concise and describe the feature/fix directly (e.g., "Add provider create form", "Fix login redirect on Safari").

### Issue Body Conventions

- **Do NOT list or link an issue's sub-issues in the parent body** (no "Sub-issues" section, no bulleted child links). Linear renders an issue's children natively — a manual list just clutters the description and goes stale as children are added or removed. A parent body should carry the objective, any single-source-of-truth pointer, and acceptance criteria — nothing that restates the hierarchy.
- **No timestamped or dated section headers** (e.g. `## Data model — corrected (2025-05-01)`). State the current spec cleanly; issue history already records the "when." Dated "correction" sections accumulate as noise.

### Client Feature Request — Frontend

> **Important:** Do NOT guess which pages/components need updating. Check the client's repo (`app/pages/`, `app/components/`) to identify the correct files and routes. If the repo is not accessible, add a **## To Determine** section listing what needs to be verified before work begins (e.g., "Which page renders the jobs list? Check repo.").

```
Title: Feature description
Priority: High (2) or Medium (3)
Labels: Feature, Frontend
Estimate: XS/S/M/L/XL
Description:
  ## Context
  [Why does the client need this?]

  ## Requirements
  - [ ] Requirement 1
  - [ ] Requirement 2

  ## UI Notes
  - Page/route: `/path` ← verified from repo, NOT guessed
  - Components: [Which Volt components are relevant — VoltCard, VoltDataTable, etc.]
  - Follow DESIGN_LANGUAGE.md (zinc palette, no decorative shadows)

  ## To Determine (if repo not checked)
  - [ ] Which page/route handles this feature?
  - [ ] Which existing components need modification?

  ## Acceptance Criteria
  - [ ] What "done" looks like
```

### Client Feature Request — Backend / API

> **Note:** Backend issues should describe *what* functionality is needed, not *how* to implement it. The Backend lead knows which endpoints to create, how to structure handlers, and what validation to add. Focus the description on the functionality the backend needs to support and any business rules or constraints.

```
Title: Feature description
Priority: High (2) or Medium (3)
Labels: Feature, Backend (+ DB if it changes the schema)
Estimate: XS/S/M/L/XL
Description:
  ## Context
  [Why does the client need this? What problem does it solve for the client?]

  ## Functionality
  - [What the backend needs to support — describe the behavior, not the implementation]
  - [Business rules, constraints, edge cases]
  - [What data needs to be stored, returned, or transformed]
  - [Auth considerations if non-standard (e.g., public access, webhook)]

  ## Acceptance Criteria
  - [ ] What "done" looks like from a functionality perspective
  - [ ] Tests written
```

### Fullstack Features — Split Into Separate Issues

When a feature requires both backend and frontend work, **always create separate issues** — one for backend and one for frontend. Link them using **Linear's dependency system** so the frontend issue is blocked by the backend issue.

> **Reminder:** For the frontend issue, verify affected pages/components from the client's repo. Don't guess file paths — check `app/pages/` and `app/components/` in the actual codebase.

This keeps issues focused, enables parallel assignment (the Backend lead on backend, the Frontend/PM lead on frontend), and makes progress tracking clearer. Using Linear dependencies (rather than just mentioning the dependency in the description) makes the blocking relationship visible in the UI, prevents the frontend issue from accidentally being started too early, and keeps the dependency machine-readable.

**Steps:**
1. Create the **backend issue** using the "Client Feature Request — Backend / API" template above (labels: `Feature`, `Backend`, plus `DB` if it changes the schema)
2. Create the **frontend issue** using the "Client Feature Request — Frontend" template above (labels: `Feature`, `Frontend`)
3. **Create the Linear dependency:** update the frontend issue with `mcp__linear__save_issue` `blockedBy: ["<backend issue identifier>"]` (or pass it on create), so the backend issue blocks the frontend issue

**Example:** "Add admin button to complete all job tasks"
- **Backend issue:** Support marking all tasks for a job as complete in a single operation; admin-only, should be atomic
- **Frontend issue:** Admin-only button on job page, confirmation dialog, API call, toast
- **Dependency:** frontend issue `blockedBy` the backend issue

> **Note:** If the feature is simple enough that the backend is trivial (e.g., a single straightforward CRUD endpoint), it's acceptable to create one combined issue assigned to the person doing both. Use your judgement.

### Bug Report
```
Title: Fix: brief description of the bug
Priority: Urgent (1) or High (2)
Labels: Bug, Frontend|Backend|DB
Description:
  ## Bug
  [What's happening vs. what should happen]

  ## Steps to Reproduce
  1. Step 1
  2. Step 2

  ## Environment
  [Browser, OS, user account, etc.]

  ## Likely Location
  - [File path if known, e.g., server/api/users/[id].get.ts or app/pages/users.vue]
```

### Backend / Data Modeling Task

> **Note:** Focus on *what* data needs to be modeled and *why*, not on prescribing specific schema details or endpoint structures. Include business context and constraints so the Backend lead can make the right design decisions.

```
Title: Description of the task
Priority: as appropriate
Labels: Backend, DB
Estimate: XS/S/M/L/XL
Description:
  ## Objective
  [What data model or API change is needed and why]

  ## Requirements
  - [What data needs to be stored/tracked]
  - [Relationships to existing data (e.g., "each job has many tasks")]
  - [Business rules and constraints]
  - [Any existing data that needs migrating]

  ## Acceptance Criteria
  - [ ] What "done" looks like
  - [ ] Tests written
```

### Tech Debt / Maintenance
```
Title: Chore: description
Priority: Medium (3) or Low (4)
Labels: Tech Debt, Frontend|Backend|DB
Estimate: -/XS/S/M/L
Description:
  ## What
  [What needs to be done]

  ## Why
  [Why it matters — tech debt, performance, DX, etc.]

  ## Files Affected
  - [List key files/directories]
```

---

## Assignment Guidelines

Issues are assigned by role: the **Frontend/PM lead** or the **Backend lead**. `node linear.mjs init` binds each role to a Linear member in `~/.config/linctl/workspace.json` — read it to know who they are, or pass `--assignee frontend` / `--assignee backend` to the CLI.

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

Use the Linear CLI to query the initiative and pull fresh issue data:
```bash
# Get the initiative's current content
node linear.mjs get-initiative-by-name "ClientName"
# List all issues to see current statuses
node linear.mjs list-issues
```

Then update the initiative's content in Linear (use a file for the markdown body):
```bash
node linear.mjs update-initiative "$INITIATIVE_ID" --content-file ./initiative-notes.md
```

---

## Project & Milestone Hierarchy

Linear organizes work in a top-down hierarchy: **Initiative → Project → Milestone → Issue**. Here's how the Gallop team uses each level.

### Initiative (= Signed Proposal)

An **Initiative** represents **one signed proposal** for a client, not the client itself. A client who signs a second proposal (a later phase, a separate engagement) gets a **second initiative** — never a second set of projects bolted onto the first. The initiative's scope is fixed by what was signed.

**The current roster is not stored in this repo — fetch it live from Linear.** Initiatives are the source of truth for which engagements exist, their descriptions, and their repo links:

- **List all clients:** `mcp__linear-server__list_initiatives`
- **Read a client's full details (overview, repo structure, domain notes):** `mcp__linear-server__get_initiative` — these live in the initiative's `content` field
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
6. **Track progress in Linear.** After creating/updating projects or milestones, update the initiative's content in Linear to reflect the current structure (see "Post-Organization: Update Initiative in Linear" below).
7. **When creating issues with the CLI**, use the `--project` and `--milestone` flags to place issues correctly in the hierarchy.

### CLI Examples

```bash
# List projects for the team
node linear.mjs list-projects

# List milestones within a project
node linear.mjs list-milestones "$PROJECT_ID"

# Only inside a confirmed R project: create a milestone for one of the revision's deliverables
MILESTONE_ID="$(node linear.mjs create-milestone "$R_PROJECT_ID" "Deliverable name" | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).data.projectMilestoneCreate.projectMilestone.id))")"

# Creating a project is only for a CONFIRMED out-of-scope revision — next R<n>, same initiative
node linear.mjs create-project --name "[KEY] R1 — Revision Name" --initiative "$INITIATIVE_ID" --description "Short description"

# Create an issue within a project and milestone
node linear.mjs create-issue \
  --title 'Add provider create form' \
  --description '...' \
  --priority high \
  --state backlog \
  --assignee frontend \
  --labels feature,frontend \
  --project 'project-uuid-here' \
  --milestone 'milestone-uuid-here'
```

---

## Contributing Back

This skill grows by capturing what it missed. If you just worked through something in this domain that this skill did not cover — an error you had to figure out, a behavior that contradicts what is documented above, a workflow knot — ask the user: **"Want me to contribute this back to the linear skill?"**

If yes, run `/contribute-skill`. If that command is not available, do the equivalent inline: distill the generic lesson (placeholders only — no project names, IDs, domains, or secrets), then branch or fork [gallop-systems/agent-skills](https://github.com/gallop-systems/agent-skills) and open a PR editing this skill.
