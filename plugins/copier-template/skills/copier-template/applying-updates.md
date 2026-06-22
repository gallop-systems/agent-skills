# Applying a Template Update in a Descendant

Usually triggered by the automated "template update available" PR — its body contains the runbook; this file is the full procedure with the judgment calls spelled out.

**The point is not to bump the version number.** It is to standardize whatever the template now sells *while preserving this app's behavior*. For every release in range: understand what it changed, decide how it fits THIS app, and merge it in. A PR that only advances `_commit` / a version string without absorbing the template's actual changes is a failure, not a success — escalate instead of shipping one.

This procedure runs unattended end to end. There is no "ask the user" step mid-run — finish in one of the honest end states at the bottom.

## Before you start: establish a green baseline

Post-update failures are only attributable if main was clean first.

```bash
gh run list --branch main --limit 1 --json conclusion,headSha   # latest main CI green?
git checkout main && git pull --ff-only && git status --short    # clean, up to date
```

If main's CI is red *before* the update, note it — that failure is pre-existing and must not be attributed to (or silently fixed under cover of) the template bump. If you can't confirm a baseline, say so in the PR body.

**Diff the bot's branch against current main first.** The notification branch (`chore/template-update`) is cut far behind main — often tens of commits — and main has frequently *already* absorbed equivalent changes through normal feature work, so the real conflict set is much smaller than the version delta implies. Start the update from current main, not from the stale bot branch:

```bash
gh pr view <n> --json title,body,headRefName
git log --oneline origin/main..origin/chore/template-update   # how stale is the bot branch?
git checkout -B chore/template-update origin/main             # rebuild the branch onto current main
```

## The sequence

```bash
# clean tree required — copier refuses otherwise
git stash --include-untracked -m "wip before template update"   # if dirty

uvx copier update --trust --defaults --skip-tasks

# triage
git status --short                 # UU = unmerged (inline conflict markers)
find . -name '*.rej'               # hunks copier couldn't apply
grep _commit .copier-answers.yml   # confirm the new (latest) version
```

- **`--skip-tasks`**: `_tasks` (migrations, `npx volt-vue add`, seeds) only run on initial `copy`, but skip them explicitly so an update never fires surprise scaffold work (a stray migration, a regenerated component). Run any genuinely-needed task by hand afterward.
- **Dirty-tree refuses on untracked dirs/files too**, not just staged changes — `git stash` alone misses them. Use `--include-untracked`, or move local-tooling dirs (`.agents/`, `.claude/`, `.do/`, editor swap files) aside and restore them after.
- **The landed version is almost always higher than the bot PR advertised** — `copier update` targets the latest tag. Read the real version from `_commit` *after* the run and title the commit/PR from that. A multi-version jump means several releases land at once — budget for more conflicts.

## Understand what changed before you resolve anything

Resolving conflicts blind produces a literal bump. Read the delta first.

**Enumerate every release in range**, not just the endpoints — copier jumped straight to the latest tag, so several releases may have landed at once:

```bash
TPL=<template-url>
git ls-remote --tags --refs --sort=v:refname "$TPL" 'v*'   # full tag list; pick OLD..NEW
gh release list --repo <template-owner/template-repo> --limit 20
gh release view v<X> --repo <template-owner/template-repo>  # read each release's notes, oldest→newest
```

Read the **cumulative compare** the bot links (or build it): `<template-url>/compare/v<OLD>...v<NEW>`. Scan specifically for:

- **Breaking changes** — renamed/removed questions, restructured `template/` layout, moved files (a factory file relocating, an auth file added).
- **CI / workflow** changes — new jobs, a changed gate (`ci-success`), runner/tool-version bumps.
- **Scaffold-owned files** the template overwrites silently (configs, lint/tsconfig, `main.css`, seed/factory/preview-login files).
- **New `_tasks` or dependencies** the descendant must now satisfy.

Write down, per release, what it sells. That list is the checklist the final PR body is graded against, and it tells you which conflicts are load-bearing vs cosmetic.

## Resolving conflicts

Copier writes diff3-style inline markers:

```
<<<<<<< before updating
<your project's current content>
||||||| last update
<what the old template version had>
=======
<what the new template version has>
>>>>>>> after updating
```

Survey all conflict blocks first: `awk '/^<<<<<<< /,/^>>>>>>> /' <file>`.

**Decision procedure per file** — check `git log --oneline -- <file>`:

| File history | Resolution |
|---|---|
| Hand-customized in this project | Keep ours (project side) |
| Untouched scaffold since generation | Take theirs (template side) |
| Shared file with both kinds of changes (login page, CI workflow, app config) | Merge both — keep project customizations *and* add the template's new feature |

Mechanical resolutions with perl (whole-block operations, safe for multi-line):

```bash
# keep ours: delete the entire conflict block (template side discarded)
perl -0pi -e 's/^<<<<<<< before updating\n(.*?)^\|\|\|\|\|\|\| last update\n.*?^>>>>>>> after updating\n/$1/gms' <file>

# keep both sides (ours then theirs)
perl -0pi -e 's/^<<<<<<< before updating\n(.*?)^\|\|\|\|\|\|\| last update\n.*?^=======\n(.*?)^>>>>>>> after updating\n/$1$2/gms' <file>
```

After editing markers out, **`git add` each resolved file** — it stays `UU` until staged, and an unstaged `UU` later blocks `git stash pop` and the push.

**`package.json` dependency pins — keep *this repo's* versions, not the template's.** The template's Renovate bumps every pin in `package.json.jinja`, so each release moves those lines and they arrive here as conflicts. But a descendant runs its **own** Renovate, which keeps its deps ahead of — and CI-tested against — the template's pins, so the template side is almost always *behind*. Resolve each dependency-version conflict by **keeping ours**, with two exceptions:

- **`@gallopsystems/agent-skills`** is template-owned (the descendant's `renovate.json` is configured to ignore it, so the template is its only updater). Always **take theirs** for that line.
- If the template's pin is genuinely *higher* than ours (this repo lagged — Renovate paused, or a dep Renovate doesn't manage), taking theirs is fine **only when it's an obviously-safe move** — a patch within the same minor. For a minor/major where ours is behind, keep ours and let this repo's Renovate make the jump afterward rather than adopting the template's pin blind.

A *new* dependency the template adds is not a conflict (the descendant doesn't have it yet) — copier just adds it; keep it. This rule is only about shared pins. The split is deliberate: the template owns `agent-skills`, each descendant owns its own app dependencies.

**Scaffold files arrive written against the TEMPLATE's schema — adopt the feature, adapt it to yours; never a naive side-pick.** Files like preview-login, factories, seeds, and `auth.d.ts` ship assuming the template's columns (`first_name`/`last_name`, `deactivated_at`, numeric `id`). A descendant that diverged (a single `name` column, camelCase, string IDs) won't compile against them. Take the template's *feature* but rewrite it to the real schema: revert `Number(id)` coercions, fix the anchor-user/seed columns, drop selects on columns that don't exist, repair the matching test. After adopting any such file, grep it against the real `db.d.ts`:

```bash
grep -nE 'first_name|last_name|deactivated_at|Number\(' <adopted-file>
```

**Convention migrations require porting, not side-picking.** When a release *moves* a convention (e.g. factories relocating from `server/test-utils/` into a shared `server/db/factories.ts` with a new `DbLike` type), a naive ours/theirs pick loses every project-specific factory. Port them into the new shape. Clone the template at the exact target tag to get the authoritative "after":

```bash
git clone --depth 1 --branch v<NEW> <template-url> /tmp/tpl-<NEW>
```

When a conflict reflects a deliberate template convention change (snake_case session fields, a renamed env var), migrating *toward* the template and updating the few consumers kills future churn — unless it's an intentional permanent fork (styled-PrimeVue vs Volt, a deliberately different env-var name), which you keep.

**`.rej` files** — copier couldn't apply a hunk because the local file diverged too far. A `.rej` is a unified diff of *just the rejected hunk*; the target file was left untouched there. Triage each:

```bash
find . -name '*.rej'
cat path/to/file.ext.rej          # ` ` context, `-` old template line, `+` new template line
```

1. **Read the hunk's intent** — the `+` lines are the new template content; `-` lines are what the old template had (which this project already diverged from).
2. **Classify**: template intent (a feature/fix every descendant should get) vs a deliberate project customization at that spot. Template intent → apply it by hand into the live file, adapting to local naming. Project customization → keep the project's version; note the intentional skip.
3. **Check adjacent content** — copier may have dropped project-specific lines near the hunk (local vars in `.env.example`, an extra `package.json` script). Diff the region against `origin/main` before trusting the live file.
4. **`rm` the `.rej`** only after the live file reflects your decision — a committed `.rej` is a defect.

`.env.example` recurs as a separate `.rej` even when everything else merged inline — always check for both.

**Review every silently-overwritten file — a clean, conflict-free merge can still be harmful.** Copier overwrites scaffold-owned files with **no markers**, and its text merge is structure-blind: it has duplicated `public:` inside `runtimeConfig` and the entire `@theme`/CSS-token block in `main.css`, both of which would silently break the app. `git diff` everything the update touched, not just the `UU` files:

```bash
git diff origin/main --stat            # everything the update touched
git diff origin/main -- <file>         # per-file: keep / revert / merge — watch for duplicated keys/blocks
```

- A new template assumption can be wrong for this project → revert the bad part, note it, and consider whether the *template* needs the fix (open a template issue/PR if other descendants are affected).
- An overwritten config the project had customized → re-apply the project's customization on top of the template's new baseline.

**CI workflows get explicit, line-by-line attention — never blind-accept them:**

1. Diff the new workflow: `git diff origin/main -- .github/workflows/`.
2. Understand **what the new template CI does** — new jobs, changed triggers, the gate job (`ci-success`), runner/tool versions.
3. Decide, per change, **whether it's an improvement this app wants**, and keep it.
4. **Preserve the app's own CI** — project-specific jobs, secrets, deploy steps, matrix tweaks the template doesn't know about. Merge them on top; don't let the overwrite drop them.
5. **Validate the adopted commands actually fit**: does `test:run` accept `--shard`? do the new `ci-success` `needs:` reference the repo's real job names? does a new job hard-code an env name the harness doesn't read (e.g. `TEST_POSTGRESQL_CONNECTION_STRING` when the harness reads `NUXT_DATABASE_URL_TEST`)? does the Postgres service version match? Conflict-resolved YAML can be valid yet reference scripts/jobs that don't exist.
6. If the gate job name or required contexts changed, reconcile with branch protection (see SKILL.md → *Branch Protection in Descendants*).

A chore that recurs every single update (e.g. `fmt:check` always failing on arrival) is a signal to fix the **template**, not the descendant — flag it upstream.

Final sweep before staging — both marker kinds and leftover `.rej`, excluding vendored noise:

```bash
grep -rnE '^<<<<<<< |^>>>>>>> ' . --exclude-dir=node_modules --exclude-dir=.yarn   # .yarn release contains literal >>>>>>>
find . -name '*.rej'                                                                # must be empty
```

## Validate, commit, and decide merge-readiness

```bash
git add -A   # includes .copier-answers.yml — it must be committed with the update
yarn install && yarn typecheck && yarn lint && yarn fmt:check && yarn test:run
git status --short   # re-check for newly-generated install artifacts (a new symlink dir, lockfile churn)
```

- **Brand-new scaffold files can fail `fmt:check` on arrival** (a new `.mcp.json` with a leading blank line) — even a conflict-free update needs the full suite, because new files aren't pre-formatted to your formatter.
- **A template/Nuxt bump drags dependency-alignment failures that look like update breakage** — e.g. a `vue-router@^4` pin throwing `ERR_PACKAGE_PATH_NOT_EXPORTED` after the bump wanted `^5`, or a newly-strict `@vue/language-core` flagging valid Vue. Fix the dependency/toolchain drift; don't revert the template change.
- **A bumped post-install dep can generate new artifacts the old `.gitignore` misses** (a `.agents/` symlink dir). Add the ignore + `git rm -r --cached <dir>`, but still stage `.copier-answers.yml`.
- **Recover non-destructively.** `git reset --hard` / `git stash drop` risk discarding the update work (and are blocked under agent auto-mode). Prefer `git checkout --ours/--theirs`, `git rm --cached`, `git merge --abort`. If a `reset --hard origin/<branch>` is genuinely warranted, first prove the commits being discarded are already in main.

**If a check fails, prove whether it's pre-existing** before blaming the update: `git worktree add /tmp/<proj>-main origin/main`, symlink `node_modules`, rerun the failing check there. A byte-identical failure on main means fix-forward in this PR, not a regression. A local lefthook pre-push hook may block on such a pre-existing failure — only bypass (`--no-verify`) once you've proven it reproduces on pristine main and CI is the real gate; push with `--force-with-lease` since the branch was rebuilt.

### Commit / PR body template

Commit as `chore: update to template vX.Y.Z`. The body is the audit trail for the squash-merge — it must show the update was *absorbed*, not just stamped:

```
chore: update to template vX.Y.Z

Version: vOLD → vNEW (copier jumped to latest)
Releases included: vA, vB, vNEW

Notable upstream changes (what the template now sells):
- vA: <feature/fix> — applied / adapted as <how>
- vB: <CI change> — kept <X>, preserved app's <Y>
- vNEW: <breaking change> — handled by <how>

Conflicts & resolutions:
- path/to/file: kept ours (hand-customized) — <why>
- path/to/file: took theirs (untouched scaffold)
- path/to/file: merged — project <X> + template <Y>
- path/to/file.rej: applied template intent by hand / intentionally skipped — <why>

Reverted template changes (wrong for this app):
- <file>: <what + why>; template issue: <link or "n/a">

Validation: typecheck / lint / fmt / tests — <pass | pre-existing failure on main: link>
Baseline: main CI was <green | red (link)> before this update.
```

Retitle the bot PR to match: `gh pr edit <n> --title "chore: update to template vX.Y.Z"`, push, watch CI. The bot's empty placeholder commit disappears in the squash.

### What "done" means

Land in one of three honest end states:

- **`pr_open`, ready for human review** — every release in range absorbed, all conflicts resolved with rationale, `.rej`/markers gone, CI green (or failure proven pre-existing), PR body complete. **Do not self-merge a template update** — stop here for a human to merge. This is the normal success state.
- **`pr_open`, escalated** — you hit a conflict you cannot resolve safely (a breaking change whose correct adaptation is ambiguous, a template assumption that contradicts core app behavior, CI you can't get green without guessing). **Escalating is correct.** Push what you have, mark the PR a **draft**, and write the blocker explicitly in the body: which release, which file, the two options, why you stopped. **Never paper over it by reverting the hard part and shipping a literal version bump** — a bump that drops the template's real change is worse than an open question.
- **No change needed** — `_commit` already equals the latest tag (main absorbed it). Close the bot PR with a note.

The bar: would a reviewer reading the PR body see *what each version changed and how it was fit into this app*? If not, it is not done.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Destination repository is dirty; cannot continue` | `git stash --include-untracked` — plain `git stash` misses untracked files/dirs (editor swap files, local-tooling dirs), which still count as dirty |
| Copier refuses to render at all | Template has `_tasks` — add `--trust` |
| Hangs or fails in non-interactive shells | Add `--defaults` (and `--data key=value` for questions without defaults) |
| Update wants to run scaffold tasks (migrations, component installs) | Add `--skip-tasks`; run any genuinely-needed task by hand |
| Update landed a version you didn't expect | `copier update` always targets the latest tag; pin with `--vcs-ref v<X.Y.Z>` if you need a specific one |
| Conflict marker grep returns hits in `.yarn/` | False positives from the vendored yarn release — `--exclude-dir=.yarn` |
| An auto-merged file looks fine but the app breaks | Structure-blind text merge duplicated a key/block (`runtimeConfig.public`, `main.css` `@theme`) — `git diff origin/main` the non-conflicted files too |
| Tempted to just edit `_commit` / a version string to make the diff small | Stop — that's the literal-bump failure. The template's changes must be merged, not stamped. Re-run `copier update` clean; if conflicts are unresolvable, escalate (see *What "done" means*) |
| Template change is wrong for this project | Revert locally, note it in the commit body, open a template issue/PR if other descendants are affected |
