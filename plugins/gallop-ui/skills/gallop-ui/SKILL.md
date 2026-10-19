---
name: gallop-ui
description: Use and change gallop-ui, Gallop's shared Nuxt UI layer that every Gallop app vendors at `layers/gallop-ui` by git subtree (it replaced PrimeVue/Volt). Use whenever you work in a repo that has a `layers/gallop-ui` folder and touch UI (pages, components, forms, tables, styling, dark mode, `app.config` `gallopUi`), when choosing or building a component, when pulling a gallop-ui release (`yarn ui:pull`, `ui:migrate`), when changing the layer itself (the gallop-systems/gallop-ui repo), or when anyone asks about Gallop UI components, `pt`, tokens or `/_ui`.
---

# gallop-ui

gallop-ui is Gallop's shared UI: Vue components, composables and formatters, built as a **Nuxt layer**. Every Gallop
app holds a copy at `layers/gallop-ui`, pulled from `gallop-systems/gallop-ui` with `git subtree` at a tagged
release, so an app's repository is complete on its own (no registry, no token, easy hand-over). It replaced
PrimeVue and Volt in every app. The layer is behaviour on **Reka UI**, styled with **Tailwind 4** and the app's
colour tokens.

- **The copier-nuxt template** scaffolds new apps with the layer already added, the `yarn ui:*` scripts
  (`scripts/gallop-ui.mjs`), Tailwind pointed at the layer, lefthook guards and the layer's tests in CI. The template
  ships infrastructure on its own cadence; the layer ships UI faster, by subtree.
- **Which apps use it:** every app made from the template. The layer may not name clients, so the list isn't kept
  in it. Find them on this machine with `ls -d ~/Projects/*/layers/gallop-ui`, which is also how `yarn ui:impact`
  finds them.
- **The source of truth is the layer's own docs, in the subtree, at the app's version.** Don't trust memory, or
  this skill, for a prop name: read the file.

| File (under `layers/gallop-ui/`) | What it answers |
|---|---|
| `CATALOGUE.md` | Every component and composable, what it is, "use it for" phrases. Start here. |
| `components/<Name>/<Name>.md` | One component: when (not) to use, props, slots, events, `pt` sections, examples, migrating, a11y. |
| `CLAUDE.md` | The layer's rules for people and agents who change it. |
| `README.md` | Adding the layer, taking versions, customizing (`pt`, `gallopUi`), restyling states. |
| `TOKENS.md`, `FORMATTERS.md` | The colour-token contract; `formatDate`, `formatCurrency`… and time zones. |
| `CHANGELOG.md`, `migrations/<version>/`, `docs/migrating-to-*.md` | What changed, and the codemod tables. |
| `docs/decisions.md` | Settled API names and who decided them. Read before proposing a rename. |
| `docs/playground.md` | `/_ui` and `yarn ui:impact`. |

`yarn ui:version` prints the app's layer version.

## Core rules

1. **Never edit `layers/gallop-ui` in an app** for an app's need. Restyle with `class`, `pt` or `gallopUi.pt`;
   change the layer in the gallop-ui repo ([changing-the-layer.md](changing-the-layer.md)).
2. **Never shadow.** No file in `app/components` may register under a layer component's name. Adopting a layer
   component deletes the app's copy in the same change. `yarn ui:check` enforces it.
3. **The docs in the subtree win.** Before using a component, read its `.md`. Before writing a prop, check it there.
4. **Dark mode is required.** Every app ships it. Colours come from tokens, never a raw palette class plus `dark:`.
5. **Same or better, never a regression** — in look, behaviour and speed, light and dark, desktop and phone. Explain
   every visual difference you cause.
6. **Naming and API calls go to the owner.** You may decide implementation; you don't decide a new public name.
7. **Client-neutral layer.** No client names, data, domain terms, screenshots or URLs in the layer: code, docs,
   tests, commit messages, PR text.
8. **Subtree PRs in an app are merged with a merge commit, never squashed.** Layer PRs are squashed.
9. **Git hygiene:** never `git stash`, never `--no-verify`, never `pkill -f`; work in a new worktree; leave
   uncommitted work alone ([pitfalls.md](pitfalls.md)).

## Which component? (decision procedure)

1. **Search.** `grep -i "<what you need>" layers/gallop-ui/CATALOGUE.md` (the "Use it for" column lists the phrases
   people search with), then read the `.md` of every candidate, especially "When not to use". Browse `/_ui` in
   `yarn dev` to see it in the app's own theme.
2. **Exact match:** use it. Restyle with `class` (= `pt.root`) or `pt`; an app-wide look goes in `gallopUi.pt`.
3. **Close match:** prefer, in order, a prop, a `pt` section, a slot. Don't wrap it to bolt on behaviour, don't fork
   it, don't shadow it. If it truly lacks an option every app could use, propose extending it in the layer
   (backward compatible).
4. **No match:** compose layer primitives in the app. Propose a layer component when a second app needs the same
   thing or it is a generic pattern. Composites in the layer are built only from layer primitives; a missing
   primitive is built first.

Detail, and how to propose a component: [finding-a-component.md](finding-a-component.md).

## Pull an update (decision procedure)

New worktree from `origin/main` → `yarn ui:pull vX.Y.Z` (its own commit; needs a clean tree) → read `CHANGELOG.md`
and `migrations/` between the two versions → on a breaking release, `yarn ui:migrate --dry`, then `yarn ui:migrate`
and work its checklist → `yarn ui:tokens`, `yarn ui:check` → remove workarounds the release makes unnecessary → full
tests and a before/after visual sweep → PR, merged with a **merge commit**.
Steps and commands: [pulling-updates.md](pulling-updates.md).

## Change the layer (decision procedure)

Worktree of the gallop-ui repo from `origin/main` → read its `CLAUDE.md` and `docs/decisions.md` → change, keeping
the four files per component (`.vue`, `.md`, `.stories.ts`, `.test.ts`) in step → `yarn test`, `yarn typecheck`,
`yarn catalogue`, `yarn docs:check` → look at `/_ui` light and dark, at 1280 and 390 → `node scripts/impact.mjs`
across every app → Conventional Commit, PR, squash-merged only when CLEAN.
Steps: [changing-the-layer.md](changing-the-layer.md). Proving other apps don't break:
[checking-other-apps.md](checking-other-apps.md).

## Reference files

- [using-in-an-app.md](using-in-an-app.md): auto-imports, `pt`, `class`, `gallopUi` in `app.config`, merge order,
  tokens and dark mode, formatters, `/_ui`.
- [finding-a-component.md](finding-a-component.md): exact, close and no match; primitives vs composites; proposing
  a component.
- [api-principles.md](api-principles.md): the API rules every component follows, and the bar for an API change.
- [pulling-updates.md](pulling-updates.md): taking a release into an app, the codemod, proof.
- [changing-the-layer.md](changing-the-layer.md): building or changing a component in the gallop-ui repo, and
  releasing.
- [checking-other-apps.md](checking-other-apps.md): `ui:impact`, screenshot sweeps, computed styles, grepping call
  sites, the DataTable `:key` rule.
- [pitfalls.md](pitfalls.md): working rules learned the hard way.

## Contributing Back

This skill grows by adding what it doesn't cover yet. If you just worked through something in this domain that this
skill did not cover (an error you had to figure out, behaviour that doesn't match what's documented above, a
workflow knot), ask the user: **"Want me to contribute this back to the gallop-ui skill?"**

If yes, run `/contribute-skill`. If that command is not available, do the equivalent inline: distill the generic
lesson (placeholders only: no client names, IDs, domains or secrets), then branch or fork
[gallop-systems/agent-skills](https://github.com/gallop-systems/agent-skills) and open a PR editing this skill. A
rule about the layer's own API belongs in the layer's docs (`CLAUDE.md`, a component `.md`), not here.
