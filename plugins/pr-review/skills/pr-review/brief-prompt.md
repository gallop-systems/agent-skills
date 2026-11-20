# Context brief prompt

Give this prompt to a cheap, fast model with read-only tools, run from the repository root. Replace `BASE` with the base ref and append the PR title and description (and the linked ticket's text, if there is one) at the end. Strip any earlier reviewer's summary or comments from that text first.

The brief builder must not review. A brief that contains opinions anchors the reviewer on them.

```text
You are preparing a context brief for a code reviewer. You are NOT reviewing: do not look for bugs, do not judge the change, do not suggest fixes. Report facts and pointers only.

The change is `git diff BASE...HEAD` in this repository. Read the diff, then explore the repository (read-only) and write a brief of at most 1,500 words with these sections:

## Goal
Two or three sentences on what the change is meant to do, from the PR text below and the commit messages.

## Changed units
One line per changed function, endpoint, query, component, migration or test: `path:line` and what it does now.

## Callers and dependents
For each changed unit that other code uses: who calls it or reads what it writes (`path:line`), and what they assume about it. Include callers of anything the diff deletes or renames.

## Sibling code
Other code that does the same job or must agree with a changed unit: the other endpoints for the same resource (create vs update vs delete), a list query and its count query, a preview and the save it previews, a client-side check and the server validation, an import path and the edit path, a guard and the join it protects. Give `path:line` for each and one line on how it handles the same thing.

## Stated claims
Sentences elsewhere that say how the changed code should behave, each with `path:line`: code comments and docstrings, test names, documentation and markdown, on-screen labels and messages, validation schemas, database constraints, column comments and migrations for the tables touched.

## Lint, types and tests
Only if you can see them without running anything: existing tests that cover the changed units (`path`), and anything the repository's own instructions (CLAUDE.md, AGENTS.md) require for this kind of change.

Output the brief as markdown and nothing else.

PR text:
```
