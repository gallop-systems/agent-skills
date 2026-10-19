# Pulling a gallop-ui release into an app

An app takes layer releases deliberately, one app at a time. The pull, the codemod and the hand fixes are one PR,
merged with a **merge commit**.

## 0. Before you start

- `git -C <app> status`. If the main checkout has uncommitted work, leave it alone: you work in a new worktree.
- Use Node 24 for everything (hooks, tests, the codemod).
- Find the current and target versions:
  ```sh
  yarn ui:version                                     # this app's layer
  git ls-remote --tags git@github.com:gallop-systems/gallop-ui.git | tail -5
  ```

## 1. Worktree and pull

```sh
git -C ~/Projects/<app> fetch origin
git -C ~/Projects/<app> worktree add ~/Projects/<app>-ui-<version> -b chore/gallop-ui-<version> origin/main
cd ~/Projects/<app>-ui-<version> && yarn install
yarn ui:pull v<X.Y.Z>        # git subtree pull --squash, committed as "chore(gallop-ui): pull v<X.Y.Z>"
```

- **The pull is its own commit, with nothing else in it.** Don't amend it or reword its message:
  `ui:migrate` finds the app's previous release from the `chore(gallop-ui): pull|add vX.Y.Z` commits in history.
- `ui:pull` needs a clean tree, and its error message says "commit or stash". **Don't stash.** Commit your work, or
  start from a fresh worktree.
- A subtree conflict means someone edited `layers/gallop-ui` in this app. Resolve it to the release's version
  (`git checkout --theirs -- layers/gallop-ui/<file>`) and tell the user what the local edit was. It belongs in the
  layer repo, or in `pt`.
- If `yarn install` reports a new peer dependency of the layer, add it at the version in
  `layers/gallop-ui/package.json` `peerDependencies`.

## 2. Read what changed

```sh
sed -n '/^## \[<X.Y.Z>\]/,/^## \[<current>\]/p' layers/gallop-ui/CHANGELOG.md
ls layers/gallop-ui/migrations/; cat layers/gallop-ui/docs/upgrading.md
```

For each entry, decide: does this app call it (`git grep -n "<Component\|propName" -- app tests`), and does the call
site need to change? Read the affected components' `.md` "Migrating" sections. A release that crosses a major
version has a `migrations/<version>/` folder; `docs/upgrading.md` explains how to apply it. Jumping several releases is
fine as long as you read every entry in between. The kit only knows the versions it has tables for, so check the
migration doc for how far back it reaches.

## 3. Run the codemod on a breaking release

```sh
yarn ui:migrate --dry            # the diff and counts; nothing written
yarn ui:migrate                  # rewrites app/ and tests/, writes MIGRATION-<version>.md
```

- Commit the kit's output on its own (`chore(gallop-ui): run the <version> codemod`), then the hand fixes, so a
  reviewer can tell the two apart.
- Work through every unchecked item in `MIGRATION-<version>.md` (rows marked `manual`, sites the kit listed but
  couldn't rewrite, renamed names inside assertions). Tick each box as you go. Running the kit again is safe.
- Useful flags: `--only <area|Component>`, `--from <version>`, `--dir app,shared`, `--verbose`, `--check` (CI).
- Breaking rows are also in `layers/gallop-ui/migrations/<version>/*.json`, each with a `note`. Grep them when an
  item is unclear.

## 4. Tokens, guards and workarounds

```sh
yarn ui:tokens                   # theme CSS vs the token contract: missing tokens, old names
yarn ui:check                    # no shadowing, no mixed commits
git grep -n "TODO(gallop-ui" -- app tests
```

- Add any token the release needs to the app's `main.css`, light and dark (`light-dark()`), using the app's own
  palette. `theme/neutral.css` has the reference values.
- **Remove workarounds the release makes unnecessary:** `TODO(gallop-ui)` code it fixes; app `pt` that now equals
  the layer default; wrappers, guards or global CSS that patched a layer bug. Each removal must keep the look and
  behaviour identical. Keep a deliberate design pin (a compact filter bar, say) and say so in the PR.
- **DataTable cells with state:** any stateful component in a DataTable cell slot (an inline editor, an input, an
  open Tooltip, local `ref` state, focus) needs `:key="row.id"` on it. Rows are patched in place on a page turn, so
  without a key the state follows the position to another row. Grep every `#cell-*` slot, and prove it: with the
  state active, turn the page and check that it didn't carry over.

## 5. Prove it

Same or better, never a regression:

- `yarn lint`, `yarn typecheck`, `yarn fmt:check`, `yarn ui:check`, `yarn build`.
- Backend and frontend tests under `TZ=UTC` **and** `TZ=America/New_York`, against a throwaway Postgres
  ([pitfalls.md](pitfalls.md)).
- A visual before/after: `origin/main` against your branch, on the same throwaway DB, at 1280 and 390, light and
  dark. Cover the main pages, every page whose call sites or workarounds you touched, and every component the
  changelog names. Exercise them (open popovers, Selects by mouse and keyboard, drag on a Board). Explain every
  difference. See [checking-other-apps.md](checking-other-apps.md) for the method.
- No layer warnings in the dev console on the main pages.

## 6. PR and merge

- Title: `chore(gallop-ui): take v<X.Y.Z>` (or the app's convention). In the body: the version jump, what the
  codemod changed, the hand fixes, workarounds removed, visual differences with reasons, and the test runs.
- **Merge with a merge commit** (`gh pr merge <n> --merge --delete-branch`). A squash merge loses the subtree
  metadata and breaks the next `ui:pull`. Don't split the pull into its own PR either.
- Merge only when checks are green and the PR is CLEAN, and only if you were asked or delegated to.
- After merging, remove your worktree and any throwaway database.
