# `linear.mjs` — CLI Fallback

Read this only when you need an operation the Linear MCP server doesn't expose (see **Linear Tooling** in `SKILL.md`). The workflow rules in `SKILL.md` — status, placement, labels, templates — apply no matter which tool you use.

The fallback tooling is a single zero-dependency Node script, `bin/linear.mjs`. It runs on bare `node` (v18.3+ — no `npm install`, no `tsx`, no build step) and uses symbolic names instead of raw UUIDs (`--state backlog`, `--assignee frontend`, `--labels bug,frontend`).

Invoke it as `node <skill>/bin/linear.mjs <command> [args] [--flags]`. Examples below write `node linear.mjs` for brevity — use the full path to the file, or `cd` into the skill's `bin/` directory first. Run `node linear.mjs help` for the full command list.

It wraps the Linear GraphQL API and reads `LINEAR_API_KEY` from the environment plus the workspace config from `~/.config/linctl/workspace.json`. There is nothing to source — every invocation loads config fresh.

## Setup (run once per user)

### Workspace bootstrap config

Before running any `linear.mjs` command, verify that the per-user workspace config exists at `~/.config/linctl/workspace.json` (override path with `$LINCTL_WORKSPACE_FILE`). This file holds **every team** in the workspace (each with its own UUID plus its workflow-state and label UUIDs — states differ per team), an optional `defaultTeam`, and the Linear member UUIDs that play the Frontend/PM and Backend roles. Without it, every command that needs the team, members, states, or labels fails.

> **Multi-team workspaces:** `workspace.json` registers all teams, but `states`/`labels` are per-team (each team's `Todo` is a distinct UUID). Which team a command targets is resolved in this order: the **`--team <key|name|uuid>`** flag → the **`LINCTL_DEFAULT_TEAM`** env var (a per-repo default — set it via direnv/`.envrc` or your shell so every command in a repo targets that team) → the **`defaultTeam`** field in `workspace.json`. If none resolve, `--team` is **required** on team-scoped commands; workspace-wide commands (e.g. `list-initiatives`) work without a team. A legacy config (predating per-team support, i.e. with no `defaultTeam` key and top-level `states`/`labels`) still works — it falls back to the first registered team — but re-run `init` to migrate it to the per-team schema.

```bash
[ -f "${LINCTL_WORKSPACE_FILE:-$HOME/.config/linctl/workspace.json}" ] && echo "ok" || echo "missing"
```

**If missing,** instruct the user to run:

```bash
node linear.mjs init
```

`init` calls Linear's GraphQL API, lists the workspace's members, and prompts the user to designate (1) the Frontend/PM lead and (2) the Backend lead by number, then (3) an optional default team key (blank = no default, so `--team` is required on each team-scoped call). It registers **all** teams with their per-team states/labels and writes `~/.config/linctl/workspace.json`. The config is read fresh on every invocation — no re-sourcing needed.

### `LINEAR_API_KEY`

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

## Symbolic names (no UUIDs needed)

The CLI resolves friendly names against `workspace.json`, so you rarely need raw UUIDs:

```
--team       ACME | "Acme Corp"  (team key or name)                          (or a UUID)
--state      todo | backlog | "in progress" | "in review" | done | canceled   (or a UUID)
--assignee   frontend | backend                                               (or a UUID)
--labels     bug,frontend,feature  (comma-separated label names)              (or UUIDs)
--priority   0-4  or  none | urgent | high | medium | low
```

`--team` selects which team a team-scoped command runs against, and `--state`/`--labels` then resolve against **that team's** states and labels. When `--team` is omitted it falls back to `$LINCTL_DEFAULT_TEAM` (a per-repo default) and then to `workspace.json`'s `defaultTeam`; if none are set you'll get an error listing the registered team keys. Workspace-wide commands (initiatives) don't need a team. Any value that's already a UUID is passed through untouched. Label names match case-insensitively with `-` and space interchangeable (`tech-debt` → `Tech Debt`), but `init` only registers the type and domain labels (`discovery`, `tech-debt`, `bug`, `feature`, `improvement`, `frontend`, `backend`, `db`) — apply the status flags (`client-request`, `Needs Clarification`, `agent blocked`) via the MCP server or by UUID. Project and milestone IDs are still UUIDs (pass them with `--project` / `--milestone`).

## Creating Issues

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
  --title 'Login redirect fails on Safari' \
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

## Listing & Filtering Issues
```bash
# List all issues (pretty table by default)
node linear.mjs list-issues

# Filter by state type: backlog, unstarted, started, completed, canceled
node linear.mjs list-issues started

# Raw JSON output (for piping) — add --json to any list command
node linear.mjs list-issues --json
node linear.mjs list-issues started --json
```

## Updating Issues
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

## Issue Dependencies

Prefer the MCP relations (see `SKILL.md`); these are the fallback:

```bash
# Create a "blocks" dependency (backend blocks frontend)
node linear.mjs add-dependency "$BLOCKER_ISSUE_ID" "$BLOCKED_ISSUE_ID"

# List all dependencies for an issue (both directions)
node linear.mjs list-dependencies "$ISSUE_ID"

# Remove a dependency by relation UUID (get UUID from list-dependencies)
node linear.mjs remove-dependency "$RELATION_ID"
```

## Comments
```bash
# Add a comment to an issue
node linear.mjs add-comment "$ISSUE_ID" --body "Comment body text here"

# Long comment from a file (no shell-escaping)
node linear.mjs add-comment "$ISSUE_ID" --body-file ./comment.md
```

## Searching
```bash
node linear.mjs search-issues "login bug"
```

## Projects & Milestones
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

# Only inside a confirmed R project: create a milestone for one of the revision's deliverables
MILESTONE_ID="$(node linear.mjs create-milestone "$R_PROJECT_ID" "Deliverable name" | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).data.projectMilestoneCreate.projectMilestone.id))")"

# Creating a project is only for a CONFIRMED out-of-scope revision — next R<n>, same initiative
node linear.mjs create-project --name "[KEY] R1 — Revision Name" --initiative "$INITIATIVE_ID" --description "Short description"
```

## Bulk Moves (MCP has no equivalent)
```bash
# Move many issues to a milestone — 0.5s delay between calls so Linear doesn't drop writes.
# Keep batches to ~9 issues and verify (list-project-issues) between batches.
node linear.mjs batch-move-to-milestone "$MILESTONE_ID" "$ISSUE_ID_1" "$ISSUE_ID_2" "$ISSUE_ID_3"
```

## Raw GraphQL
```bash
# Escape hatch for anything else, e.g. a field save_issue didn't apply
node linear.mjs api 'mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }' \
  '{"id": "issue-uuid", "input": {"projectMilestoneId": "milestone-uuid"}}'
```

## Initiatives
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

## Info Commands
```bash
node linear.mjs list-states        # Workflow states
node linear.mjs list-members       # Team members
node linear.mjs list-labels        # Labels
```
