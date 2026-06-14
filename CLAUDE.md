# agent-skills

This repository distributes Claude Code **skills and plugins** — it contains no
application/runtime code, only skill content (Markdown references, examples, plugin
manifests).

## Commit & PR conventions

Releases are automated via release-please, which derives version bumps from
[Conventional Commits](https://www.conventionalcommits.org/) — using the **PR title**
(squash merge) and commit messages. Scope the type to the plugin where practical,
e.g. `docs(nuxt-nitro-api): ...`.

**Every type ships a release except `chore`** (see the config in
`release-please-config.json` — all `changelog-sections` are visible, only `chore`
is `hidden: true`). So a skill is the product: edit it under the type that matches
the *size* of the change, and it will publish. There is no "this won't ship"
problem for content — pick the honest type.

| PR title type | Version bump | Use for |
|---|---|---|
| `feat(<plugin>): …` | **minor** (x.**Y**.0) | A new skill, or a new capability / reference file. |
| `fix(<plugin>): …` | patch | Correcting wrong or broken skill content. |
| `docs(<plugin>): …` | patch | Edits, clarifications, new guidance within existing skills. |
| `refactor(<plugin>): …` | patch | Reorganizing/moving skill content. |
| `perf` / `style` / `test` / `build` / `ci` | patch | Their literal meaning (mostly repo tooling). |
| `chore: …` | **no release** | Repo-meta that must not ship. Also the type release-please uses for its own release PRs — shipping it would loop, which is why it's the one excluded type. |
| `feat!:` or a `BREAKING CHANGE:` footer | **major** | A breaking change to a skill's contract. |

Default for routine skill edits is now `docs`/`fix`/`refactor` (a **patch**) — do
**not** reflexively use `feat`, or every edit cuts a full minor. Reserve `feat`
for a genuinely new skill or a new reference file.

## Controlling the exact version: `Release-As`

release-please reads a **`Release-As: X.Y.Z`** footer and bumps to exactly that
version, overriding the type-derived bump. Use it to keep a change to a patch when
the type would otherwise over-bump, or to set a deliberate version.

```
docs(vue-nuxt): expand the slots reference and add three idioms

Release-As: 1.7.1
```

Because PRs are **squash-merged**, the footer must land in the **squash commit
body** — put it in the PR description (and confirm the squash commit includes it;
`gh pr merge --squash --body "…Release-As: X.Y.Z"` guarantees it). A `Release-As`
footer in a branch commit that gets squashed away will be lost.

## After a release: bump the template

These skills ship to the [nuxt-copier-template](https://github.com/gallop-systems/nuxt-copier-template),
which pins `@gallopsystems/agent-skills` in `template/package.json.jinja` so every
generated/updated project gets them. **Whenever a skills release publishes a new
version, bump that pinned floor in the template** — otherwise descendants stay on
the old skills until someone notices.

So the full chain for any skill change is: merge here → release-please publishes a
new `agent-skills` version → **bump `@gallopsystems/agent-skills` in the template,
then tag + release a new template version**. The template-side procedure (PR, tag,
GitHub release) lives in the `copier-template` skill →
[Releasing a Template Version](plugins/copier-template/skills/copier-template/SKILL.md#releasing-a-template-version).
