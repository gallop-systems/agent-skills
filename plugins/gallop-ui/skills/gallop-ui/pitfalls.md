# Pitfalls and working rules

Rules learned the hard way while building the layer and moving every app onto it. Most cost someone real work.

## Git

- **Never `git stash`**, and never a bare `git stash pop`. Stashes are shared across every worktree of a repo, and
  other people's stashes have been put at risk. Commit to a branch, or start from a fresh worktree.
- **Never `--no-verify`**, not even "temporarily". If a hook fails, fix the cause. A pre-push test that times out
  under load: rerun that test alone, capture its name, retry the push at most twice, then report.
- **Don't touch uncommitted work.** Many main checkouts have it. Check `git status`, then work in a new worktree from
  a fresh `origin/main`: `git worktree add ~/Projects/<repo>-<topic> -b <branch> origin/main`. Don't touch other
  people's or agents' worktrees.
- A branch created from `origin/main` tracks main. Push with an explicit refspec: `git push -u origin <branch>`.
- **Subtree PRs in an app: merge commit. Layer PRs and release PRs: squash.** Getting either wrong costs a broken
  `ui:pull` or a skipped release.
- Don't reword or squash the `chore(gallop-ui): pull vX.Y.Z` commit: `ui:migrate` reads it to find the previous
  version.
- One commit must not mix `layers/gallop-ui` and app files (`ui:check --staged` blocks it).
- If a push, merge or other action is denied by permissions, stop and report it. Don't route around it.

## Processes and ports

- **Never `pkill -f`** (or any pattern kill). It has killed other agents' dev servers. Stop only what you started,
  by its saved PID or by your own port, and always with `-sTCP:LISTEN` (without it, `lsof` also matches clients
  connected to the port, such as a browser or an editor helper):
  ```sh
  lsof -ti tcp:<port> -sTCP:LISTEN | xargs kill
  ```
- **Use your own ports.** Never 3306 (MySQL), 5432 or 5433 (Postgres), even if they look free: a cleanup on those
  ports has killed a real database server.
- The shell is zsh: an unquoted `$var` holding a list doesn't word-split, there is no `timeout`, and `sed -i` needs
  `''` (BSD). Use the Write tool or a script file instead of long heredocs.

## Databases and secrets

- **Throwaway Postgres only,** on your port, with `fsync=off`, `synchronous_commit=off`, `full_page_writes=off` and
  `timezone=America/New_York` (slow fsync caused pre-push flakes; a zone mismatch breaks `updated_at` tests). Remove
  it afterwards.
- Never migrate, seed or write a real local database. Never edit a real `.env`; copy `.env.example` into your
  worktree. Never use or print production credentials.

## Tests

- Node 24 for hooks, tests and the codemod (`export PATH=$HOME/.nvm/versions/node/v24.11.1/bin:$PATH`, or `nvm use
  24`). Node 22's ICU formats currency differently and fails tests.
- Run date-related tests under both `TZ=UTC` and `TZ=America/New_York`. Never depend on the live clock: fake the
  timers and set the system time.
- Fix a flaky test deterministically (stub `requestAnimationFrame`, await the right tick), not with retries.

## Layer and app gotchas

- **`class` didn't apply?** Check whether the default is a state the component knows (write a plain class or the
  matching `data-[size=sm]:` variant), a Reka runtime state (write the same `data-highlighted:` variant in that
  section), or a `dark:` default your class didn't restate.
- **`size-*` on an `<Icon>` does nothing.** Use `text-*`.
- **A Tailwind class written outside `components/` in the layer is never generated.** Apps scan only
  `layers/gallop-ui/components`.
- **An app component named like a layer one** shadows it, which is not allowed. `ui:check` fails on it, so delete the
  app copy when adopting the layer's.
- **A pt section that recoloured a ring** may need a pseudo-element variant after a release that moved the ring
  (Board's lane highlight moved to `after:ring-*`). Read the CHANGELOG entry.
- **Field text is 16px on phones** by design. Don't pin `text-sm` on fields to undo it, and remove old app-wide
  anti-zoom CSS that duplicates it.
- **A closed Select is a plain button;** Reka mounts on first open. Code that keeps a `triggerRef` across the first
  open must read it again.
- **DataTable cell state follows the position** on a page turn unless the stateful component has `:key="row.id"`.
- **Don't copy an old phone table** with `layout="table"`: phones get cards.
- **`/_ui` shows the wrong font?** The app sets its font from a layout. Move it to `--font-sans` in `@theme`.
- **Don't trust a subagent's "done".** Check the diff, the CI state and the screenshots yourself before reporting or
  merging.
