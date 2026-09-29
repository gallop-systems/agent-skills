# Stacked PRs with `gh stack`

Use the [`github/gh-stack`](https://gh.io/stacks) extension for any chain of dependent PRs. It tracks the chain locally, keeps PR bases right, and registers a native **stack** on GitHub. GitHub merges a stack atomically, bottom-up.

```bash
gh extension list | grep stack || gh extension install github/gh-stack   # needs gh >= 2.90
```

## Stack only when the child truly depends on the parent

If the follow-up doesn't need the parent's code, branch it from main and skip stacking. When it does depend, **never hand-set a PR's base to another feature branch** (`gh pr create --base <parent-branch>`):

- **Merge order decides what reaches main.** Merge the child first and it lands on the parent's branch, not main. It only reaches main if the parent is merged *afterwards*. Nothing warns you either way.
- **GitHub may lock hand-chained PRs.** It can group PRs whose bases chain into a stack object. After that, `gh pr edit --base`, REST and GraphQL all refuse with `Cannot change the base branch because the pull request is part of a stack`. Deleting a merged base branch then **closes** the child PR instead of retargeting it.

## Command map

| Command | Does |
|---|---|
| `gh stack init [b1 b2 …]` | Start a stack, or adopt existing branches bottom→top (missing branches are created, existing PRs are found). `--base <trunk>` for a non-default trunk. |
| `gh stack add <branch>` | Create a branch on top of the current stack and check it out. |
| `gh stack submit` | Push every branch, create missing PRs, fix bases, create/update the GitHub stack. |
| `gh stack push` | Push every branch only. No PR or stack changes. |
| `gh stack rebase` | Fetch trunk, then cascade-rebase every layer. Flags: `--upstack`, `--downstack`, `--no-trunk`, `--continue`, `--abort`. |
| `gh stack sync` | `rebase` + push + refresh PR state in one go (use after a PR merges). |
| `gh stack view` | Show the stack. `--short` or `--json` for parsing. `⚠` means the branch needs a rebase. |
| `gh stack checkout <stack#\|pr#\|url>` | Import a stack from GitHub (e.g. a teammate's) and set up local tracking. |
| `gh stack link <b\|pr> …` | Create or extend a GitHub stack from branches/PR numbers, with no local tracking. |
| `gh stack merge [<stack#\|pr#>]` | Atomic merge of the stack, up to and including the given PR. |
| `gh stack trunk` / `top` / `bottom` / `up` / `down` | Navigate. |

## Building a stack

**From scratch:**

```bash
git switch main && git pull --ff-only
gh stack init feat/<part-1>          # bottom branch, based on main
# …commit…
gh stack add feat/<part-2>           # next layer on top
# …commit…
gh stack submit --auto --open        # push all, open PRs, create the stack
```

**Adopt branches (and PRs) that already exist:** `gh stack init b1 b2 b3` (bottom→top), then `gh stack submit --auto --open`. Submit reports `Updated base branch for PR #n …` for any wrong base and creates the stack. This is also how you rescue a hand-chained set of PRs. If a branch exists only on `origin`, create it locally first (`git branch <b> origin/<b>`). Otherwise submit fails with `src refspec refs/heads/<b> does not match any`.

**Without local tracking:** `gh stack link <bottom> … <top>` takes branch names or PR numbers. It pushes the branches, creates missing PRs with chained bases, and creates or extends the stack.
- Grow an existing stack with `gh stack link <stack#> <new-branch-or-pr>`.
- Re-running `link` with the full list is idempotent (`Stack with N PRs is already up to date`). Use it to re-register the chain after hand-rebasing branches.
- PRs that `link` creates are **drafts**, so run `gh pr ready <n>`.
- `link` leaves nothing tracked locally, so `gh stack view` then says `not part of a stack`. Run `gh stack checkout <stack#>` to import tracking.

## Non-interactive use (agents)

- `gh stack submit` opens a TUI editor in a terminal. Pass `--auto` to skip it and use auto-generated titles. Fix those titles and bodies afterwards with `gh pr edit <n> --title … --body-file …`.
- `--auto` creates **drafts** unless you also pass `--open`. `--open` also flips **existing** draft PRs in the stack to ready. Leave it off if a PR must stay a draft.
- Conflict continue without an editor: `git add <files> && GIT_EDITOR=true gh stack rebase --continue`.
- Output carries ANSI codes and pre-push hook banners. Filter with `sed 's/\x1b\[[0-9;]*m//g'`, or read `gh stack view --json`.

## Changing a stack

1. Fix each issue **on the branch that introduced it**, committing bottom-up.
2. From that branch, run `gh stack rebase --upstack` (or plain `gh stack rebase` for the whole stack, trunk included).
3. On conflict, resolve, `git add`, then `gh stack rebase --continue`. `gh stack rebase --abort` restores every branch.
4. Run the checks on the **top** branch. A resolution that compiles on its own layer can still break a test a layer up.
5. Run `gh stack push` (branches only) or `gh stack submit` (also updates PRs/stack).

`gh stack rebase` refuses a dirty tree (`cannot rebase: You have unstaged changes`), so commit or stash first.

## After a PR in the stack merges

Run `gh stack sync` (or `gh stack rebase` then `gh stack push`). Merged branches are skipped (`Skipping <b> (PR #n merged)`). The next layer is replayed onto trunk with only its own commits (`adjusted for merged PR`), so a squash-merged parent causes none of the usual duplicate-commit conflicts. Verify with `git log --oneline main..HEAD`.

If the bottom PR merged before the stack object existed, `submit` prints `Could not create stack: Pull request #n is merged`. That is harmless: the remaining PR simply targets main.

## Merging

**Merging is the user's call.** Permission classifiers block agent-initiated merges as "Merge Without Review". Hand the user the exact command to run, e.g. `! gh stack merge <n> --yes --squash`.

- **Plain `gh pr merge` doesn't work on a stacked PR.** Use `gh stack merge`.
- **`gh stack merge <n>`** merges everything up to and including PR `<n>`. A bare number is tried as a stack number first, then as a PR number.
- **Flags:** `--yes` plus `--squash`, `--merge` or `--rebase` (or `--merge-method <m>`). There is no `--method`. Without a method flag it reuses your last method.
- **All-or-nothing.** `merge failed: … has a merge conflict` then `Stack merges are atomic, so nothing was merged`. Rebase, push and retry.
- **A draft anywhere blocks it:** `cannot merge the whole stack: pull request #n is a draft`. Run `gh pr ready <n>` first.
- **Only open/not-draft is checked locally.** Branch protection and required checks are evaluated at merge time. Wait for CI on every PR first (`gh pr checks <n>` per PR).
- **CI may not run on upper PRs.** A workflow filtered to `pull_request: branches: [main]` doesn't run on PRs based on another stack branch. Those PRs only get checks once their base merges.
- **A single PR is not a stack.** `gh stack merge` says `#n is not a stack number or a stacked pull request`, so use `gh pr merge`.
- **Afterwards:** `gh stack trunk && git pull --ff-only`, then delete the merged local branches.

## Errors → fixes

| Error | Cause / fix |
|---|---|
| `current branch "<b>" is not part of a stack` | Not tracked locally (fresh worktree, stack made with `link`, other clone). Run `gh stack init <b1> <b2> …` to adopt, or `gh stack checkout <stack#\|pr#>`. |
| `branch "main" belongs to multiple stacks; use an interactive terminal …` | You're on trunk. Check out a stack branch, or pass the number (`gh stack merge <stack#>`). |
| `… is already used by worktree at <path>` | `init`/`checkout` must switch branches, and another worktree holds that branch. Run from that worktree or remove it. Note that `checkout` may already have imported the stack before failing. |
| `branch "<b>" already exists in a stack` | An earlier (possibly half-finished) `init` tracked it. Use `gh stack checkout`. Don't `unstack` unless you mean it, because it also removes the stack on GitHub. |
| `✗ failed to push <b>: … failed to push some refs` (no detail) | Almost always the pre-push hook failed, and gh stack swallows its output. Run `git push origin <b>` to see it, fix it (often env vars the hook's tests need, which you then export in the same shell), and resubmit. |
| `src refspec refs/heads/<b> does not match any` | The branch exists only on the remote. Run `git branch <b> origin/<b>`. |
| `unknown flag: --method` | Use `--squash` / `--merge` / `--rebase` or `--merge-method`. |

## Several agents or worktrees on one repo

Stack tracking lives in the repo's shared git dir, so all worktrees see and mutate it. Give **one** agent ownership of `gh stack` commands. Other agents build branches with plain git (`git switch -c <b> origin/<parent>`), push, and report. The owner then runs `gh stack link <all PRs bottom→top>` (or `init` + `submit`) to register them.

## Recovering a hand-chained stack

- **PRs are open but chained by hand:** adopt them with `gh stack init <b1> <b2> …` then `gh stack submit`. Don't fight locked bases with `gh pr edit --base`.
- **The parent already squash-merged:** replay only the child's commits with `git rebase --onto origin/main origin/<parent-branch> <child-branch>` (see [getting-unstuck.md](getting-unstuck.md)). Then `git push --force-with-lease`, retarget, and fix any "stacked on #…" wording in the PR body. Confirm what actually reached main with `git diff origin/<parent-branch> origin/main --stat`.
- **GitHub has locked the bases and the parent is gone:** merge main into the child (resolve toward the child where it is a superset), then close the trapped PR and recreate it off main.
