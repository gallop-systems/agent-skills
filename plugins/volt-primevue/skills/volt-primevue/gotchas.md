# Gotchas

The ones that cost real debugging time in this stack.

## `@apply` of custom tokens in `<style>` needs `@reference "main.css"`

Tailwind v4 SFC `<style>` blocks need a `@reference` to resolve `@apply`. The
trap: `@reference "tailwindcss"` only loads the **default** theme — built-in
colors (`zinc`, etc.) work, but your custom `@theme` tokens (`text-fg`,
`bg-surface`) fail with *"Cannot apply unknown utility class."*

```vue
<style scoped>
/* ❌ @reference "tailwindcss";  → @apply text-fg fails */
@reference "../assets/css/main.css";   /* ✅ exposes your tokens */
.prose :where(h2) { @apply text-fg; }
</style>
```

`@reference` is relative to the SFC. Note `yarn build` validates `@apply` in
`<style>`; a bare `@tailwindcss/cli` compile does **not**, so the CLI can pass
while the real build fails — include `build` in your check.

## JS-driven colors can't read CSS tokens — use a reactive palette

Anything that sets colors as JS values (ApexCharts, canvas, SVG attributes
written from script) can't use `bg-surface`/`var(--color-fg)` — the value is
baked at render. Pick concrete colors from a reactive `prefers-color-scheme`
match and recompute on change:

```ts
const isDark = ref(false);
let mq: MediaQueryList | null = null;
const sync = () => (isDark.value = mq?.matches ?? false);
onMounted(() => {
  mq = window.matchMedia("(prefers-color-scheme: dark)");
  sync();
  mq.addEventListener("change", sync);
});
onBeforeUnmount(() => mq?.removeEventListener("change", sync));

const palette = computed(() =>
  isDark.value ? { fg: "#f4f4f5", line: "#f4f4f5", grid: "#27272a" }
               : { fg: "#18181b", line: "#18181b", grid: "#f4f4f5" });
```

Mirror the dark values from `main.css`. A chart `colors: ["#18181b"]` (near-black)
is invisible on dark — invert the line to a light value via the palette.

## A bare `boolean` prop casts to `false` when absent — `withDefaults` it

Vue's Boolean-prop casting: a prop typed `boolean` with **no default** coerces to
`false` when the parent doesn't pass it — *not* `undefined`. So a "default-on"
flag written as `responsive?: boolean` + `props.responsive !== false` is always
`false` unless explicitly passed, and the feature silently never fires.

```ts
// ❌ absent → false → feature off, no error
const props = defineProps<{ responsive?: boolean }>();
// ✅ absent → true
const props = withDefaults(defineProps<{ responsive?: boolean }>(), { responsive: true });
```

Not Volt-specific, but it bit the `SlidingTabs` responsive collapse, so it lives
here. Any "defaults to on" boolean prop must use `withDefaults` (or invert it to
an opt-out flag that naturally defaults false).

## The class merge lives in `src/volt/utils.ts` (`ptViewMerge`)

When a `pt:` class won't override, or you want to change how a component's own
classes combine with yours, the lever is **not** a global PrimeVue config — it's a
local helper. Every vendored component sets `:ptOptions="{ mergeProps: ptViewMerge }"`,
and `ptViewMerge` (in `src/volt/utils.ts`) does `twMerge(globalClass, selfClass)`
then Vue `mergeProps`:

```ts
export const ptViewMerge = (globalPTProps = {}, selfPTProps = {}, datasets) => {
  const { class: globalClass, ...globalRest } = globalPTProps;
  const { class: selfClass, ...selfRest } = selfPTProps;
  return mergeProps({ class: twMerge(globalClass, selfClass) }, globalRest, selfRest, datasets);
};
```

That `twMerge` is why a conflicting `pt:` utility wins (last-writer in the merge)
and a plain `class` may not. Debugging an override that won't take? Look here, not
at a config flag.

## Reaching internals from CSS: `data-pc-name` / `data-pc-section`

When `pt:` class styling isn't enough — you need to style a component's internals
from a parent `<style>` block or third-party CSS — PrimeVue stamps stable
`data-pc-name="<component>"` and `data-pc-section="<section>"` attributes on its
DOM. Target those instead of brittle structural selectors:

```css
[data-pc-name="select"] [data-pc-section="dropdown"] { /* … */ }
```

## Styling a nested child component: the `pc`-prefixed section

When one PrimeVue component renders another inside it, the inner one's `pt`
section name is prefixed **`pc`** (e.g. a Badge embedded in another component is
`pcBadge`). Address it through the prefix; a flat section name silently fails:

```vue
<VoltSomething pt:pcBadge:root:class="bg-red-500" />
```

## We don't use `@primevue/forms`

This stack validates with **zod + manual wiring**, not `@primevue/forms`. The
package's `zodResolver` looks tempting given how much zod is already around, but
its ergonomics weren't worth the workarounds. Don't reach for it — drive
validation from the zod schema directly (`safeParse` in the submit handler, or a
small `useFormState`-style composable).
