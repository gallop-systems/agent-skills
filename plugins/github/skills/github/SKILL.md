---
name: github
description: Team conventions for working with GitHub across repos — branch naming and Linear-issue-first branching, PR targeting and stacking, splitting backend/frontend into layered PRs, backend labels, and PR/comment writing style. Use any time you're about to create a branch, open a PR, or write a PR body or comment.
---

# GitHub Conventions

Conventions for GitHub work across repos. Use these any time you create a branch,
open a PR, or write a PR body or comment. Branches are named `<user>/<linear-id>-<slug>`,
where `<user>` is the author's short handle.

## Creating a branch for new work: create a Linear issue first

- **Rule:** Any time a **new branch is created for a distinct piece of work**, that
  branch must be backed by a Linear issue, and the branch name carries the issue's
  ID (`<user>/<linear-id>-<descriptive-slug>`). This holds in both situations a new
  branch comes about: (a) you auto-branch off `main` because the user is on `main`
  and asked to start work (the user never commits on `main`, so this is expected and
  you don't need to ask); (b) **the user is already on a feature branch and
  explicitly asks you to branch off.** Case (b) is still new work getting a new
  branch, so it still needs its own Linear issue — create one before writing code.
  The requirement attaches to *the new branch*, not to whether you started on `main`.
- **Why:** Branches lose traceability without a ticket — no issue to link the PR to,
  no place for context, and the work doesn't show on the board. The failure mode
  this guards against: the user is on a feature branch (possibly one with no Linear
  ID of its own) and says "branch off and do X"; the branch gets created but no
  issue does, leaving a new branch with no ticket. The branching itself is correct;
  the step that gets missed is the issue.
- **How to apply:** When you're about to create a new branch for new work — `git
  checkout -b` for anything the user is starting: (1) invoke the `linear` skill and
  create an issue describing the work — follow that skill's conventions for project,
  cycle, and template; (2) name the new branch from the new issue's ID: `git
  checkout -b <user>/<linear-id>-<descriptive-slug>`. Do this inline on the main
  loop, not via a subagent — subagents run in a restricted permission context where
  the Linear MCP calls get denied even when those tools are allowlisted, so
  delegating just wastes a round-trip before falling back to the main loop anyway.
  When the user is on a feature branch and asks to branch off, **the new branch gets
  its own new issue's ID** — do not inherit the current branch's slug or ID, and do
  not fall back to an ID-less name just because the current branch has none. **Skip
  issue creation ONLY when one of these is explicitly true:** the user said not to
  create a ticket; the work is already tied to an existing Linear issue the user
  mentioned; or you're not creating a new branch at all (continuing on the current
  branch). **Do not skip on your own judgment that the work is "too small," trivial,
  or throwaway** — the user would rather have an issue they didn't need than be
  missing one they did. When in doubt, create the issue.

## Branch naming

- **Rule:** Branches follow the Linear issue convention so PRs auto-link to the
  correct ticket: `<user>/<linear-id>-<descriptive-slug>`. Because every new branch
  for a piece of work gets a Linear issue first (see above), essentially every
  branch carries an ID. The slug must describe what is actually being built, not the
  layer or a generic placeholder.
- **Why:** Linear pairs PRs to issues by branch-name prefix, so the ID is what makes
  the eventual PR show up against its ticket.
- **How to apply:** The Linear ID comes from one of: (a) an issue you just created
  per the rule above; (b) the `<team>-NN` prefix already on the current branch,
  **but only when you're stacking or splitting further work off that same issue** —
  never as a substitute for creating an issue for genuinely new work; (c) an ID the
  user mentioned. If you're on a feature branch that has no ID and the user asks you
  to start new work, that is a signal to **create an issue**, not to produce an
  ID-less branch. Examples: `<user>/<team>-87-estimate-from-rfp-endpoint`,
  `<user>/<team>-87-estimate-from-rfp-button`. The only branches without an ID are
  the narrow skip cases; name those `<user>/<descriptive-slug>`.

## Never stage or commit a `carry-plan` planning doc during feature work

- **Rule:** While a feature is in progress, its `docs/<slug>.md` plan file (managed
  by the `carry-plan` skill) is untracked and visible in `git status` — but it must
  **never** be staged or committed as part of a feature commit. Stage feature
  changes by explicit path; never `git add .` or `git add -A` while a plan file
  exists. Before every commit, run `git diff --cached --name-only` and confirm no
  `docs/<slug>.md` is in the staged set. The plan file only ever gets committed in
  the final PR, after the `carry-plan` skill has rewritten it from planning voice to
  "what was done" voice.
- **Why:** The plan file is a working document that contains in-flight decisions,
  open questions, and resume hints — none of which belong in the repo history.
  Committing it during feature work pollutes commits with planning churn, exposes
  half-baked thinking to teammates reviewing the diff, and means the "final" version
  has to be reconstructed from rewrites instead of being the only version in history.
- **How to apply:** Any time you're about to commit while a `docs/<slug>.md`
  planning file exists in the tree: (1) stage only the explicit paths the commit
  needs, never `git add .` / `git add -A`; (2) run `git diff --cached --name-only |
  grep -F docs/<slug>.md` and confirm it prints nothing; (3) if it does print, `git
  restore --staged docs/<slug>.md` before committing. At PR-open time, the plan file
  should not appear in `git log -p` for the branch — if it does, you committed it
  prematurely and need to scrub the history before opening the PR. The single
  exception is the final PR opened via the `carry-plan` Phase-2 flow, where the
  rewritten doc is committed deliberately.

## PR targeting

- **Rule:** PRs always target `main`, even when the branch was created off another
  feature branch (e.g. a stacked frontend PR built on top of a backend branch).
  Don't change the target to the parent feature branch — keep it on `main` and note
  the dependency in the PR body.
- **Why:** Targeting `main` keeps the merge story uniform and avoids leaving stale
  base branches around after the parent merges. The dependency is a process note for
  the reviewer, not a Git relationship.
- **How to apply:** When opening any PR (`gh pr create`), set `--base main`. If the
  branch is stacked on another open PR, add a "Depends on #N — merge that first" line
  in the body so the reviewer knows the order. Once the parent merges into `main`,
  rebase the stacked branch onto `main` so the diff cleans up.

## Splitting backend and frontend into separate, layered PRs

- **Rule:** When a task spans backend and frontend, and the backend work stands on
  its own (e.g. an endpoint that supports a broader surface than what this frontend
  consumes), ship them as **two PRs**: one backend PR, and one frontend PR stacked
  on top of it. Both target `main`. The frontend branch is created **off the backend
  branch** (not off `main`), so the frontend PR's diff stays clean once the backend
  lands. Note in the frontend PR body that it depends on the backend PR being merged
  first.
- **Why:** Backend changes that are broader than the immediate frontend need
  (general-purpose endpoint, schema change, etc.) deserve review on their own
  merits, independent of UI specifics. Bundling them obscures the backend contract
  under frontend churn, slows review, and makes rollback all-or-nothing. Stacking
  the frontend on the backend branch keeps the frontend PR's diff scoped to UI
  changes only, while still letting the user develop both in parallel.
- **How to apply:** Two paths to the same outcome:
  - **Path A — split decided up front.** Starting from `main`, work not yet begun:
    (1) create the backend branch off `main` (named per the Branch naming and
    issue-first rules), do the backend work, open PR #1 targeting `main`; (2) create
    the frontend branch off the backend branch (same `<user>/<linear-id>` prefix), do
    the frontend work, open PR #2 targeting `main` with a body note like "Depends on
    #<backend-PR> — merge that first."
  - **Path B — split decided mid-flight.** Already on a Linear feature branch with
    BE+FE changes mixed in the working tree. **Use the procedure in the next section
    — do not try to recreate Path A by stashing or cherry-picking.**

  If the backend work is trivially small or only meaningful in service of this exact
  frontend (no broader surface), one combined PR is fine — don't split for its own
  sake.

## Splitting a mixed BE+FE feature branch into PRs

- **Rule:** When the user is already on a Linear feature branch (e.g.
  `<user>/<team>-92-foo`) that has both backend and frontend changes in the working
  tree (staged, unstaged, or already committed in a mix) and asks for "a backend PR"
  or "two PRs, one backend and one frontend," follow this exact procedure. **Rename
  the current branch in place** to carry a backend-ish name — don't create a new
  branch and don't try to cherry-pick. The working tree already has everything; the
  rename preserves it. The `<user>/<linear-id>` prefix **must** be preserved on both
  branches so PRs auto-link to the same Linear issue, but the rest of the name is
  flexible. Default to the `-backend` / `-frontend` suffix; reach for a descriptive
  name (e.g. `<user>/<team>-92-rfp-endpoint` / `<user>/<team>-92-rfp-button`) when
  the two layers are doing meaningfully different things and the suffix would
  undersell that.
- **Why:** This is the flow the user actually works in: mixed BE+FE work on the
  issue's branch, split decided at PR time. Renaming the current branch keeps every
  uncommitted edit intact with zero risk of losing work, and branching the FE off the
  renamed backend branch means the FE branch inherits the same working tree without
  any stashing or cherry-picking dance. Both branches carry the original Linear ID,
  so both PRs auto-link to the same issue with no sub-issue needed.
- **How to apply:** Starting state: current branch is `<user>/<linear-id>-<slug>`,
  working tree contains BE and FE changes, possibly with some changes already
  committed on the branch.
  1. **Rename** the current branch to add the `-backend` suffix:
     ```bash
     git branch -m "<user>/<linear-id>-<slug>-backend"
     ```
     If commits exist on the branch from the mixed work, leave them — they'll become
     part of the backend PR's history. If that's not what the user wants, confirm
     before proceeding.
  2. **Stage and commit backend files only.** Backend = anything under `server/` plus
     migrations/schemas/db utils. Stage by explicit path, never `git add .`. Leave FE
     changes uncommitted in the working tree.
  3. **Push and open the backend PR** targeting `main`, with the `Contains Backend
     Changes` label (and `db migration` label if applicable).
  4. **(Only if the user asked for two PRs.)** Branch the frontend off the backend
     branch — the FE changes in the working tree carry over because the branch point
     is the current commit:
     ```bash
     git checkout -b "<user>/<linear-id>-<slug>-frontend"
     ```
  5. **Stage and commit the frontend files.** Push.
  6. **Open the frontend PR** targeting `main`, with `Depends on #<backend-PR>` in
     the body.

  If the user asked for only "a backend PR" (not both), stop after step 3. The FE
  changes sit uncommitted on the `-backend` branch — that's fine. Do not proactively
  create the frontend branch.

  Do **not** delete or otherwise touch the original branch name — the rename in step
  1 is the only mutation to it.

## Defensive PR bodies for backend / endpoint changes

- **Rule:** When opening a PR that adds or changes a backend endpoint, schema, or
  other server-side surface, write the PR body **defensively**: explain *why* you
  took the specific approach, not just what changed. Anticipate the questions a
  reviewing engineer is likely to raise (e.g. "why a new endpoint instead of
  extending the existing one?", "why this column on this table?", "why this
  validation here and not at the call site?") and address them up front in the body.
  This applies only to approaches you've actually thought through and can technically
  defend.
- **Rule (reverse side):** If, while drafting that defensive explanation, you surface
  a legitimate challenge you can't cleanly answer, **do not** paper over it in the
  body. Stop, go back to the drawing board, and reconsider the approach. The
  defensive write-up is a forcing function for honest self-review, not a sales pitch.
  Only ship the PR once you can defend the approach against the challenges you
  imagined.
- **Why:** Backend choices have long blast radii (API contracts, data shape,
  migrations) and reviewers can't always tell from the diff alone whether the
  obvious-looking alternative was considered. Stating the rationale up front shortens
  the review loop, prevents back-and-forth, and shows the design choice was
  deliberate. Forcing yourself to articulate the rationale also catches weak
  approaches before they reach review.
- **How to apply:** Before running `gh pr create` on a backend PR, draft a "Why this
  approach" or "Design notes" section. Reference alternatives **only in passing**, as
  part of describing what you did — not as a list of paths-not-taken. Good: *"Added a
  new `/api/foo/bar` endpoint instead of extending `/api/foo`, because the response
  shape and caching profile are different."* Bad: *"I considered extending `/api/foo`
  and patching each call site, but that would be a recurring tax."* The first frames
  the chosen approach and slips the alternative in as a comparator; the second turns
  the body into a defense of a road not taken. Keep it tight (a few bullets, not an
  essay). If drafting this section exposes a real weakness in the approach, treat that
  as a signal to revise the implementation, not the body. Skip this section for
  trivial backend changes (typo fixes, dependency bumps, obvious refactors) where the
  diff speaks for itself.

## PR body and comment writing style

- **Rule:** Do not use em dashes (`—`) in PR bodies or PR comments (review comments,
  issue comments, etc.). Use a period, comma, colon, parentheses, or a regular hyphen
  instead, depending on what the sentence actually needs.
- **Why:** Em dashes read as AI-generated in PR copy. Cleaner punctuation reads as
  human-written.
- **How to apply:** Before submitting any `gh pr create`, `gh pr comment`, `gh pr
  review`, or similar command, scan the body string for `—` (and the ASCII surrogate
  `--` used as a dash) and rewrite those clauses with cleaner punctuation. This
  applies to PR titles too. It does **not** apply to commit messages or to code/file
  contents — only to GitHub-facing prose.

## Don't justify a name by knocking down alternatives

- **Rule:** When the PR body talks about a name (a new table, column, endpoint,
  function, etc.), explain *why this name fits* — but do not explain it by knocking
  down a name you rejected. No "We chose X over Y to avoid Z," no "X reads better than
  Y," no surfacing alternatives the reviewer never had to consider. If the chosen name
  reflects a real semantic or technical fact, say *that*. If it doesn't, don't write
  anything about the name at all.
- **Why:** Comparing the picked name against a rejected name turns the PR body into a
  defense of a road not taken, which is exactly what the "Defensive PR bodies" rule
  already warns against. The reviewer doesn't need to know what alternatives you
  considered; they need to understand the thing you actually built. Stating the
  rejected name also pulls attention onto bikeshed-y territory and reads as
  over-explaining.
- **How to apply:** When drafting a PR body, scan for sentences that name a rejected
  alternative or compare the chosen name against another option. Rewrite them as
  positive descriptions of what the name represents, or delete them. Good: *"An
  `assignee_designation` is a named slot that template tasks reference and a real
  person fills at instantiation."* Bad: *"We picked `assignee_designation` instead of
  `role` because…"*

## Don't cite rules or conventions — give the reasoning directly

- **Rule:** When the PR body explains a choice that was made to follow a rule,
  convention, or skill, **state the underlying reasoning, not the rule**. Never write
  "per the nesting rule," "per our convention," "following the X pattern," or any
  phrasing that points at a named rule the reviewer would have to look up. If the rule
  exists, it exists because of a concrete reason — write *that* reason as the
  justification.
- **Why:** Reviewers don't care what rule was followed; they care *why the choice is
  right for this PR*. Citing a rule by name shifts the burden onto them to know or
  find the rule, and many of these rules live in personal skills files that no
  teammate can access. Even when the rule is documented, "we did this because the rule
  says so" is circular — the rule itself was written down for a reason, and that
  reason is what belongs in the PR body.
- **How to apply:** Before opening the PR, scan the body for phrases like "per the X
  rule," "per our convention," "following the X pattern," "as per," "the X convention
  says." For each one, replace the rule citation with a one-clause statement of the
  underlying reason the rule exists. Good: *"Nested under the project so callers have
  to name which project they're operating on."* Bad: *"Per the nesting rule,
  sub-resource endpoints sit under their parent."*

## "Flag-for-attention" PR comments stay factual

- **Rule:** When writing a PR comment that flags a product or design decision for the
  reviewer's attention (heads-up comments, "FYI" comments, comments calling out a
  baked-in choice), stick to the observable facts and stop. Don't pre-pick a fix,
  don't presume which alternative is correct, and don't reason about downstream
  consequences ("since this means…", "before it goes out to clients…", "so we should
  split the two paths…"). State what the code currently does, name the decision, flag
  it, stop.
- **Why:** Comments like this exist to surface a decision, not to litigate it or
  pre-commit to a remedy. Framing the reviewer's choice for them skips past the real
  question (is this approach right at all?), and reasoning about consequences is
  speculation dressed as rationale. The reviewer needs the facts and the framing of
  the decision; if they want the alternative spelled out, they'll ask.
- **How to apply:** Structure of a flag-for-attention PR comment:
  1. One sentence describing what the code currently does (the fact).
  2. One sentence describing the user-visible consequence (also a fact).
  3. One sentence flagging that it's a deliberate choice the reviewer might want to
     revisit.
  Stop there. Cut any clause starting with "since…", "so…", "meaning…", or "before…".
  Cut any sentence that names a specific fix ("we could split the paths," "we should
  add a flag"). If the alternative looks obvious to you, it'll look obvious to the
  reviewer too — let them propose it.

## Labels for backend changes

- **Rule:** Any PR that contains backend changes must have the `Contains Backend
  Changes` label applied. This applies to backend-only PRs and to combined
  backend+frontend PRs alike. Frontend-only PRs do not get the label.
- **Why:** Reviewers use the label to filter for PRs whose blast radius reaches the
  server, schema, or API contract. A missing label means a backend change can slip
  through without the right reviewer attention.
- **How to apply:** Before running `gh pr create`, decide whether the diff touches
  anything under `server/` (handlers, migrations, schemas, db utils) or otherwise
  alters server behavior. If yes, pass `--label "Contains Backend Changes"` on `gh pr
  create`. If you forget at create time, add it after the fact with `gh pr edit <PR>
  --add-label "Contains Backend Changes"`. The label name has spaces and capitals, so
  quote it exactly.

## Labels for DB migrations

- **Rule:** Any PR that adds, modifies, or removes a database migration must have the
  `db migration` label applied (in addition to `Contains Backend Changes`, since
  migrations are backend changes by definition). If the repo doesn't have a `db
  migration` label yet, create it first, then use it on the PR.
- **Why:** Migrations have a different review profile than other backend changes:
  they're not always reversible, they run against production data, and they often need
  to be coordinated with deploys. The label lets reviewers and deployers filter for
  PRs that need that extra scrutiny.
- **How to apply:** Before running `gh pr create`, check whether the diff adds or
  edits anything under the project's migrations folder (e.g. `server/db/migrations/`,
  `migrations/`, `db/migrate/`). If yes, ensure the label exists, then attach it:
  ```bash
  # Check whether the label exists in the repo
  gh label list --search "db migration"

  # If missing, create it (pick a color/description that fits — these are reasonable defaults)
  gh label create "db migration" --description "PR includes a database migration" --color "0E8A16"

  # Attach to the PR at create time
  gh pr create ... --label "db migration" --label "Contains Backend Changes"

  # Or after the fact
  gh pr edit <PR> --add-label "db migration"
  ```
  The label name is lowercase with a space, so quote it exactly. `gh label create`
  errors loudly if the label already exists, so check first or ignore that specific
  error.

## Self-audit checklist (before opening a PR or commenting)

- [ ] If you created a new branch for this work — whether auto-off-`main` or because
  the user explicitly asked you to branch off a feature branch — you created a Linear
  issue first (via the `linear` skill) and the branch name carries that issue's ID.
  You only skipped issue creation if the user explicitly said no ticket, the work was
  already tied to an issue, or you didn't create a new branch at all — never on your
  own "too small" judgment.
- [ ] Branch name is `<user>/<linear-id>-<descriptive-slug>` with a real slug (not a
  layer-only suffix). A branch with no Linear ID means you skipped issue creation —
  confirm that was one of the allowed exceptions.
- [ ] PR targets `main`. If stacked, body has a "Depends on #N" line.
- [ ] PR body and any comments contain no em dashes.
- [ ] If the diff touches backend code, the PR has the `Contains Backend Changes` label.
- [ ] If the diff adds or modifies a database migration, the PR has the `db migration`
  label (created first if the repo doesn't have it yet).
- [ ] No `carry-plan` planning doc (`docs/<slug>.md`) is staged or committed on the branch.
