---
name: codex-review
description: Run OpenAI's `codex review` CLI against the current branch's draft-PR base to get a second-opinion code review. Use whenever the user says "codex review", "run codex review", "get codex to review this", or otherwise asks for OpenAI Codex's take on the current diff.
---

# Codex Review

Thin wrapper around the `codex review` subcommand of OpenAI's Codex CLI, used to get a second-opinion review on the diff of the current branch's draft PR.

## How to use this skill

1. **Determine the base branch.** Reviews normally run against the current branch's draft-PR base. Detect it via the PR for the current branch:

   ```bash
   gh pr view --json baseRefName -q .baseRefName
   ```

   - If that succeeds, use the returned branch as the base.
   - If there's no open PR (command errors or returns empty), fall back to `main`.

2. **Scope the working tree to the PR before reviewing.** `codex review --base` reviews the committed diff *plus uncommitted working-tree changes*. If work is split across branches (e.g. a backend-only PR with frontend WIP sitting in the same working tree), unrelated changes will produce false-positive findings — codex flags the out-of-scope half as "missing asset" or "field never rendered in the UI". Before running, check `git status`; if the working tree holds changes outside this PR's scope, stash them so codex sees only the in-scope committed diff:

   ```bash
   git stash push -u -m "out-of-scope wip"   # -u includes untracked files
   ```

   Restore with `git stash pop` once the review is done. A codex finding that's purely about the stashed (out-of-scope) work is not actionable on this PR — note it and move on rather than fixing it here. When unsure whether changes belong to the PR, ask the user rather than committing cross-scope changes onto the branch.

3. **Run the review.** Stream output live so the user can watch it:

   ```bash
   codex review --base <base-branch>
   ```

   Pass through any extra args the user provided (e.g. a custom prompt).

4. **Don't summarize unless asked.** Codex's output is the artifact — the user reads it directly. If the user wants a summary or wants you to act on the findings, they'll say so.

5. **Promote the PR if codex came back clean.** If the current branch has a draft PR and codex reported no findings that need addressing (no findings at all, or only nits/non-actionable observations), do the standard PR-promotion dance per the `git-github` skill:

   ```bash
   # Ensure the "codex reviewed" label exists in the repo
   gh label list --search "codex reviewed"
   # If missing, create it:
   gh label create "codex reviewed" --description "PR has passed an automated codex review" --color "5319E7"

   # Attach the label, add a reviewer, promote out of draft
   gh pr edit <PR> --add-label "codex reviewed"
   gh pr edit <PR> --add-reviewer <reviewer>
   gh pr ready <PR>
   ```

   Skip this step when: codex surfaced findings worth fixing (the user will push fixes and re-run); the PR isn't a draft; there's no PR; or the user ran `/codex-review uncommitted` (no PR context). When in doubt about whether findings are actionable, ask the user before promoting.

## Variants

- `/codex-review uncommitted` — review the working tree instead. Run `codex review --uncommitted` (no base branch detection needed).
- `/codex-review <prompt>` — extra args are custom review instructions. Pass them as the prompt argument: `codex review --base <base> "<prompt>"`.

## Notes

- The CLI binary is `codex` (typically at `/opt/homebrew/bin/codex` on macOS). If missing, tell the user rather than installing it.
- Use a long timeout when invoking via Bash (reviews can take several minutes on large diffs).
- Do **not** add `--no-verify`-style bypass flags or pipe Codex's output through filters — the raw output is the point.
