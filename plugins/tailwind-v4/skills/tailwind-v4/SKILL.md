---
name: tailwind-v4
description: Work effectively with Tailwind CSS v4 (the CSS-first model) in a Nuxt/Vite + PrimeVue/Volt stack. Use when editing Tailwind CSS, configuring @theme/@source/@import, setting up dark mode, defining design tokens, or debugging classes that silently don't apply. Covers the v3→v4 traps an LLM trained on v3 falls into.
---

# Tailwind CSS v4

Tailwind v4 is **CSS-first**: configuration lives in your CSS file, not a
`tailwind.config.js`. Most day-to-day utility usage is unchanged and the model is
already good at it — this skill is about the **v4-specific shifts** and the traps
that come from a v3-trained prior. When a class "isn't working," the cause is
almost always one of the gotchas below.

## When to use this skill

- Editing the Tailwind CSS entry file (`@import`, `@theme`, `@source`, `@custom-variant`)
- Defining or renaming design tokens / colors
- Setting up or debugging dark mode
- A utility class silently renders nothing and you don't know why
- Migrating or porting v3 code (anything with `tailwind.config.js`, `@tailwind`, `darkMode: 'class'`)

## The CSS-first setup (no JS config)

There is **no `tailwind.config.js`/`.ts`**. The whole config is in your CSS entry
(e.g. `app/assets/css/main.css`):

```css
@import "tailwindcss";          /* NOT @tailwind base/components/utilities */
@import "tailwindcss-primeui";
@source "../../../src/volt";     /* scan sources Tailwind won't auto-detect */

@theme {
  --color-surface: #ffffff;      /* defines the bg-surface / text-surface utilities */
  --color-fg: #18181b;
}
```

Build integration is the **Vite plugin**, not the old Nuxt module or PostCSS:

```ts
// nuxt.config.ts / vite.config.ts
import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({ vite: { plugins: [tailwindcss()] } });
```

Do **not** add `@nuxtjs/tailwindcss`, a `postcss.config.js` with `tailwindcss: {}`,
or `@tailwind base/components/utilities` — those are v3 and either no-op or break.
`tailwindcss` itself must be a direct dependency (alongside `@tailwindcss/vite`),
or `tailwindcss-primeui` raises peer-dependency warnings.

## Design tokens: `@theme` vs `:root`

- A custom color token must live in **`@theme`** to generate a utility:
  `@theme { --color-canvas: #fafafa }` → `bg-canvas`/`text-canvas` exist.
  The same variable in `:root` is just a CSS variable — **no utility class**.
- **The utility name is the full `--color-*` suffix.** `--color-fg-subtle` →
  `text-fg-subtle`. A shortened or undefined name (`text-subtle`, or a dangling
  `bg-surface-strong` with no matching token) **generates nothing, with no error**
  — the element just renders unstyled. First thing to check when a custom color
  "does nothing": does the token name match exactly?
- **Inverse for PrimeUI:** PrimeVue's `--p-*` variables stay in `:root`. The
  `tailwindcss-primeui` plugin turns those into utilities — don't move them into
  `@theme`.

## `@source` — v4 only generates classes from scanned files

v4 auto-detects content, but skips files outside the project's default roots (and
anything gitignored). Classes used **only** inside a vendored/library directory
(e.g. Volt components in `src/volt`) get purged and silently go missing. Point
Tailwind at them: `@source "../../../src/volt";`. If a vendored component's
classes aren't generating, check this line first.

## Dark mode

v4's `dark:` variant defaults to **`@media (prefers-color-scheme: dark)`** (OS
preference) — there is no `darkMode: 'class'` config and no `.dark` class by
default. Two consequences:

1. **Prefer semantic tokens over `dark:` pairs.** Writing `bg-white dark:bg-zinc-900`
   on every element means one forgotten half silently breaks dark mode. Instead
   define a token that *flips its value* in one media block, and use it with no
   `dark:`:
   ```css
   @theme { --color-surface: #fff; --color-fg: #18181b; }
   @media (prefers-color-scheme: dark) {
     :root { --color-surface: #18181b; --color-fg: #f4f4f5; }
   }
   ```
   ```html
   <div class="bg-surface text-fg"><!-- flips automatically, no dark: --></div>
   ```
2. **For a manual (class/toggle) dark mode, you must redefine the variant** —
   `darkMode: 'class'` is gone:
   ```css
   @custom-variant dark (&:where(.p-dark, .p-dark *));
   ```
   Because the default keys off the OS, a JS toggle must also override the tokens
   (e.g. via a `[data-theme]` block), and any non-CSS consumer of the scheme
   (canvas/chart libs — see gotchas) must be re-notified on toggle.

## More gotchas

The full set mined from real debugging sessions — `@apply` in scoped `<style>`,
JS-driven colors that can't read tokens, `@import url()` ordering, the PrimeUI
surface ramp vs flipping tokens, and more — is in
[gotchas.md](gotchas.md). Read it when touching CSS in this stack.

## Optional tooling

The community **[`tailwindcss-mcp-server`](https://github.com/clarity-contrib/tailwindcss-mcp-server)**
(`npx -y tailwindcss-mcp-server`) exposes utility/color lookup, docs search, and
CSS→Tailwind conversion, with a `version` param defaulting to `v4`. Useful for
class discovery, but it does not encode the stack-specific gotchas above.

## Related

- **PrimeVue/Volt component styling** (`pt:` pass-through, `ptViewMerge`,
  `data-pc-*`, `@apply` + `@reference` in SFC `<style>`, reactive chart palettes):
  see the **volt-primevue** skill — it owns the component layer; this skill owns
  the Tailwind-v4 fundamentals.

## Contributing Back

This skill grows by capturing what it missed. If you just worked through something
in this domain that this skill did not cover — an error you had to figure out, a
behavior that contradicts what is documented above, a workflow knot — ask the
user: **"Want me to contribute this back to the tailwind-v4 skill?"**

If yes, run `/contribute-skill`. If that command is not available, do the
equivalent inline: distill the generic lesson (placeholders only — no project
names, IDs, domains, or secrets), then branch or fork
[gallop-systems/agent-skills](https://github.com/gallop-systems/agent-skills) and
open a PR editing this skill.
