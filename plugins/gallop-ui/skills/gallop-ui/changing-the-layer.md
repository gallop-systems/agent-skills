# Changing the layer

Fixes and features for the layer are made **in the gallop-ui repo** (`gallop-systems/gallop-ui`), not in an app's
`layers/gallop-ui`. Apps then take the change with `yarn ui:pull` once it is released. A change here reaches every
app, so the bar is higher than for app code: backward compatible, documented, tested, and checked in every app.

The layer's `CLAUDE.md` is the authority on its rules. Read it, `docs/decisions.md` (settled names) and
`docs/roadmap.md` (what's planned and open) before you start.

## 1. Worktree

```sh
git -C ~/Projects/gallop-ui fetch origin
git -C ~/Projects/gallop-ui worktree add ~/Projects/gallop-ui-<topic> -b <type>/<topic> origin/main
cd ~/Projects/gallop-ui-<topic> && yarn install
export PATH=$HOME/.nvm/versions/node/v24.11.1/bin:$PATH   # Node 24, as in CI (or `nvm use 24`)
```

(The layer's README also describes editing `layers/gallop-ui` in an app and sending it back with `yarn ui:push`.
Don't use that route unless the owner asks for it. If you do, the layer change is a commit of its own with no app
files, and `ui:check --staged` enforces that.)

## 2. Build it

- **API first.** Sketch names, props, slots, events and v-model against [api-principles.md](api-principles.md), and
  inventory how the apps would call it (`git -C ~/Projects/<app> grep -n "<pattern>" origin/main -- app`). Take any
  non-obvious name to the owner before building on it.
- **Four files per component** in `components/<Name>/`, kept in step in the same change:
  - `<Name>.vue`: `usePt` for every section a caller might restyle, `inheritAttrs: false`, `class` merged last,
    state classes chosen in script (never `data-[x]:` defaults, never `!`), `size: () => appDefault("<Name>",
    "size", "md")`;
  - `<Name>.md`: frontmatter (`name`, `tier`, `summary`, `use-for`, `related`, optional `replaces`, `built-on`),
    then When to use, When not to use, Functionality, Props, Slots, Events, Expose, Customizing, Examples,
    (Performance), Migrating, Accessibility. Every prop, slot and event has a row;
  - `<Name>.stories.ts`: the `/_ui` controls and named examples (format in `runtime/stories.ts`). A new behaviour
    gets a story;
  - `<Name>.test.ts`: behaviour tests (Vitest and @vue/test-utils).
- A new component with a `pt` goes into `GallopUiPt` in `types.ts`; a sized one into `GallopUiDefaults`.
- Colours only from tokens. A new token goes in `TOKENS.md`, `theme/neutral.css`, `runtime/tokens.ts` and the
  migration table, and needs a copier-template PR adding it to `template/app/assets/css/main.css`.
- Tailwind classes live under `components/` (apps scan only that folder). Shared class-holding code goes in
  `components/_<name>/`. Behaviour goes in `runtime/`; only public composables go in `composables/`.
- Allowed imports: `vue`, `reka-ui`, `@vueuse/core`, `@internationalized/date`, `@tanstack/vue-table` (DataTable),
  `pluralize`, `<Icon>`, and `twMerge` from `runtime/merge.ts` (never `tailwind-merge` directly). Anything new is a
  peer dependency every app must add: ask first.
- Client-neutral everywhere: generic examples (orders, projects, people), in code, docs, tests, commit messages and
  the PR.

## 3. Tests

```sh
yarn test:run            # Vitest: components in plain Vue with small Nuxt stand-ins
yarn typecheck           # extends the layer from playground/ and runs nuxi typecheck, as an app's vue-tsc would
yarn catalogue           # regenerate CATALOGUE.md from the frontmatter (CI runs `yarn catalogue --check`)
yarn docs:check          # doc sections and order, rows for every slot/event, real `related:` names, client-name check
yarn tokens:check        # if you touched tokens
```

- **No live clock in tests.** Pin time with `vi.useFakeTimers()` / `vi.setSystemTime()`, and pass `timeZone`
  explicitly. A test that depends on today's date or the machine's zone will fail on someone else's machine.
- Run date-related tests under `TZ=UTC` and `TZ=America/New_York`.
- Use Node 24 locally. Older Node's ICU formats currency differently, and CI runs 24.
- `tests/classWins.test.ts`, `tests/tokens.test.ts` and `tests/catalogue.test.ts` enforce the state-class, token and
  four-file rules. Fix the code, not the test.

## 4. Look at it

- **`/_ui` in a real app:** make a throwaway, detached worktree of an app (never its real branch), copy your layer
  over its subtree, and run it on your own port:
  ```sh
  git -C ~/Projects/<app> worktree add --detach <scratch>/<app>-preview origin/main
  rsync -a --delete --exclude node_modules --exclude .git --exclude .yarn ~/Projects/gallop-ui-<topic>/ <scratch>/<app>-preview/layers/gallop-ui/
  cd <scratch>/<app>-preview && yarn install && yarn dev --port <your port>
  ```
  Open `/_ui/<Name>`: every story, **light and dark, at 1280 and at 390** (`?theme=dark&width=390`). Never commit
  or push from that worktree. Remove it when done.
- **Every app:** `node scripts/impact.mjs` from your gallop-ui worktree compares against `origin/main` in every app
  on the machine: call sites, new type errors, and before/after screenshots of every affected story. Every changed
  screenshot must be one you meant. See [checking-other-apps.md](checking-other-apps.md).

## 5. Commit, PR, merge

- **Conventional Commits**, because release-please cuts versions from them: `feat(<Name>): …` for a new component
  or option, `fix(<Name>): …`, `docs: …`, `perf(<Name>): …`. A breaking change is `feat(<Name>)!: …` with a
  `BREAKING CHANGE:` footer, a `CHANGELOG`-ready description, and a `migrations/<version>/` row. Commits end with
  the `Co-Authored-By` trailer you were given.
- The PR body: what changed and why, the apps you checked with `impact.mjs` and what changed in each, and any naming
  call the owner still has to make. End it with the Claude Code line you were given.
- Record a settled decision, with its reason, in `docs/decisions.md`. Add planned or open work to `docs/roadmap.md`,
  and remove it there when it ships.
- **Layer PRs are squash-merged**, with the PR title as the Conventional Commit. A merge commit hides the change
  from release-please.
- Merge only when checks are green **and** `gh pr view <n> --json mergeStateStatus` says `CLEAN`, and only if you
  were asked or delegated to. Never `--admin`.

## 6. Releases

- release-please opens or updates a release PR (`chore(main): release X.Y.Z`) after each merge. **Release PRs don't
  trigger CI** (they are pushed with the workflow token). Close and reopen the PR to start the required checks;
  repeat if needed until it is CLEAN, then squash-merge it. That creates the `vX.Y.Z` tag that `ui:pull` takes.
- Never bump `package.json` or tag by hand. To force a version, put `Release-As: X.Y.Z` in a commit body on main.
- After the release, roll it into apps one at a time ([pulling-updates.md](pulling-updates.md)).
