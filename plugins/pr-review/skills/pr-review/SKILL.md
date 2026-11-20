---
name: pr-review
description: Review a branch or pull request for defects before a human sees it. Builds a context brief (what the change is for, its callers, sibling code and stated claims), hands the brief to codex review, then judges every finding against the code before anything is fixed. Use whenever the user asks to review a PR, branch or diff, says "codex review" or "review this before I merge", or when work is finished and about to be pushed for review. Tuned for Nuxt / Vue / TypeScript / Kysely + PostgreSQL apps.
---

# PR review: brief, review, judge

A reviewer is only as good as what it knows about the code around the diff. Most real findings rest on evidence outside the changed lines: a caller that assumed the old behaviour, a sibling endpoint that does the same job differently, a comment or test name that promises something the code no longer does. So the review has three steps, done by three separate sets of eyes:

1. **Brief**: a cheap model maps the code around the change. It does not review.
2. **Review**: `codex review` gets the brief and looks for defects.
3. **Judge**: every finding is checked against the code before it is fixed or shown.

On eight held-out pull requests, handing codex the brief raised the confirmed defects it found from 13 to about 21, and the confirmed medium- and high-impact ones from 6 to between 9 and 12, compared with a bare `codex review`. About one finding in five still did not survive checking, which is what the judge step is for.

## Before you start

- Work from the repository root with the change committed. Print `git branch --show-current` and `git rev-parse --short HEAD` so it is unambiguous which state was reviewed.
- Pick the base ref: the PR's base branch, or for a stacked PR the branch it is stacked on. `git diff <base>...HEAD --stat` should show only this change's files. If it shows far more, the base is wrong.
- You are the orchestrator. Do not review the diff yourself first: your own opinion of the change leaks into the brief and the judging.

## 1. Build the brief

Start a subagent on a fast, cheap model with read-only tools and give it the prompt in [brief-prompt.md](brief-prompt.md), with the base ref filled in and the PR title and description appended. If the PR or branch names a ticket, append the ticket's text too: it states the intent better than the PR body usually does. Remove any earlier reviewer's summary from the text you append.

The brief is at most 1,500 words: goal, changed units, callers and dependents, sibling code, stated claims, and existing tests. Save it to a file outside the repository. Read it once for sanity (does the goal match what the user asked for?), but do not add your own suspicions to it.

## 2. Review with codex

```bash
codex review "$(cat <<EOF
Review the changes on this branch against <base> (git diff <base>...HEAD). Report defects only, each with a concrete failing scenario.

A context brief was prepared before the review. It lists the code that calls, mirrors or makes claims about the changed code. Use it as a map of where to look; verify everything against the files.

$(cat /path/to/brief.md)
EOF
)" < /dev/null > /path/to/review.txt 2>&1
```

- **Close stdin** (`< /dev/null`) whenever codex runs from an agent or in the background. Otherwise it waits for input that never comes and hangs without an error.
- `--base` cannot be combined with a prompt, which is why the base is named inside the prompt.
- The exit code is 0 even with findings. Read the text.
- Reviews take from under a minute to several minutes. Run it in the background and read the file when it exits.
- Do not paste a checklist of past mistakes into this prompt. In testing, a long checklist did not add confirmed findings to a single reviewer and lowered the share that were real. Checklists work when each reviewer gets one narrow concern: see deep mode below.

## 3. Judge every finding

Follow [judge.md](judge.md). Use a subagent that has not seen the brief being built, give it only the findings and the base ref, and have it return a verdict per finding (real with impact, pre-existing, wrong, not a defect, unverifiable) with `file:line` evidence. A different model family from the reviewer is better: it does not share the reviewer's blind spots.

## 4. Act and report

- Fix real findings (all high and medium; low when small and local), commit, and review again if the fixes were more than trivial. Later rounds: tell codex which findings were already fixed so it does not re-flag them.
- Tell the user, in this order: the real findings and what you did about each; the findings you rejected and why, in one compact list they can overrule; pre-existing problems as possible follow-ups.
- Record the outcome in the PR description: what reviewed it, how many findings, how many fixed.

For the mechanics of the fix-and-re-review loop, see the `git-github` skill's external-review reference.

## Deep mode

For changes that touch money, permissions, migrations or concurrency, or when the user asks for a thorough review, run one focused reviewer per concern in parallel, as described in [focus-areas.md](focus-areas.md). It costs several reviews per PR and produces many more claims, so the judge step is not optional there.

## Files

- [brief-prompt.md](brief-prompt.md): the brief builder's prompt.
- [judge.md](judge.md): the five keep-rules and verdicts.
- [focus-areas.md](focus-areas.md): deep mode's concerns and prompt.
