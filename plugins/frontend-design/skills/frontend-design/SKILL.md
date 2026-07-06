---
name: frontend-design
description: Apply the team's frontend design conventions across all repos — visual hierarchy, layout, spacing, typography, color usage, component structure, and UX patterns. Use this skill any time you're creating or modifying UI (new page, new component, restyling existing markup) so the result looks and feels consistent with the rest of our apps.
---

# Frontend Design

This skill is the living reference for how UI should look and behave across our repos. The goal: every new page or component lands with the same visual vocabulary, spacing rhythm, and interaction patterns as what's already there — without anyone having to redirect on basics.

If you vibe-code UI, this skill is the safety net that catches design drift before it ships.

## How to use this skill

1. **Before writing any UI** — read the principles and rules below. Look at neighboring components in the repo to confirm conventions still hold (skills can drift; the codebase is the ground truth).
2. **While building** — keep the rules in mind for spacing, typography, color, and component composition. When in doubt, copy the pattern from an existing similar surface in the same repo rather than inventing one.
3. **Before declaring a UI task complete** — open the page in the browser and self-audit against the checklist at the bottom. If anything looks off (cramped spacing, inconsistent button styles, ad-hoc colors), fix it before handing back.
4. **When new design feedback lands** — add a rule below under the appropriate section. Each rule should include:
   - **Rule:** the do/don't, stated crisply.
   - **Why:** the reason or principle (often a specific past piece of feedback).
   - **How to apply:** when/where this kicks in while building UI.

Keep rules concrete. "Make it look clean" is useless. "Use 16px (space-4) between stacked cards, 24px (space-6) between major sections" is actionable.

## Principles

These are the high-level defaults. Specific rules below override them when they conflict.

The first three are the foundational lenses — every other principle and rule serves them.

- **Clarity.** Every element exists to communicate something specific. Text is legible at every size, icons are precise and unambiguous, and meaning is conveyed without decoration. If a user has to study an element to understand what it is or does, the design has failed. Negative space is a tool of clarity, not a luxury.
- **Deference.** The interface helps people understand and interact with content — it never competes with the content. Chrome (toolbars, borders, backgrounds, animations) recedes; data, text, and the things people are actually working on come forward. A surface at rest should feel like the content is the only thing there.
- **Depth (subtle, not skeuomorphic).** Layering and motion communicate hierarchy and continuity — what's foreground vs. background, what's modal vs. ambient, where a panel came from when it appeared. Use translucency, soft elevation, and motion that respects spatial relationships. Never use depth for decoration; only to clarify structure.
- **Delicate over heavy.** The aesthetic is restrained: thin borders, light shadows, modest font weights, generous whitespace. When in doubt, dial it down — heavy borders, bold drop shadows, oversized headings, and saturated background fills feel clunky in our apps.
- **Direct manipulation and immediate feedback.** Wherever possible, let the user act on the thing itself (click a value to edit it, drag to reorder, toggle in place) rather than going through a separate "edit screen." Every action gets immediate visible feedback — pressed states, optimistic UI updates, confirmation glyphs — so the user is never wondering whether the system heard them.
- **Forgiveness over confirmation.** Prefer easy undo (toast with "Undo" action, soft-delete with restore) over confirmation dialogs for ordinary actions. Reserve confirmation modals for genuinely destructive, irreversible operations.
- **User control.** People initiate and cancel actions. Don't auto-redirect, auto-submit, or interrupt with modals when the user hasn't asked for it. Long operations are cancellable. The user always knows where they are and how to back out.
- **Respect system preferences.** Honor the user's OS-level choices: dark/light mode, reduced motion, increased contrast, larger text. Never override these for stylistic reasons.
- **Color carries meaning, not decoration.** Color should encode state, category, or status (success/warning/danger/info, entity types, lifecycle stages). Don't color things just to make them look lively. A user should be able to glance at the screen and infer meaning from the color alone.
- **Icons are accents, not decoration.** Icons earn their place when they speed up scanning (status indicators, action buttons, type markers next to a label). They don't earn their place as ornaments next to every heading or list item. Sparing use makes the icons that *do* appear actually informative.
- **Match the neighborhood.** Before introducing a new visual pattern (a new card style, a new button variant, a new color), look at adjacent pages/components in the same repo. If the pattern already exists, reuse it. If it doesn't, ask whether this surface really needs to be different.
- **Use the design system, not bespoke styles.** Prefer existing component-library primitives (PrimeVue / Volt / Tailwind tokens) over hand-rolled CSS. If a token or component doesn't fit, push on whether the design should change to fit the system before adding custom styles.
- **Consistency builds trust.** Use familiar patterns and standard controls. A "Settings" button looks like settings buttons elsewhere; a destructive action looks destructive everywhere. Novelty in interaction patterns has to earn its place.
- **Aesthetic integrity.** The visual style matches the function. A serious tool looks serious; a playful experience can look playful. Don't dress a workspace tool in marketing gloss, and don't make a casual app feel bureaucratic.
- **Hierarchy first, decoration second.** Before picking colors or borders, make sure the visual weight (size, spacing, contrast) tells the user what's most important on the screen. Decoration should reinforce hierarchy, not compete with it.
- **Density should match the user's task.** Dense data tables for power users; airy layouts for client-facing or infrequent flows. Don't apply the same density everywhere.
- **Whitespace is structural.** Generous padding inside cards/panels, consistent gaps between siblings, and clear separation between sections. Cramped UIs read as low-effort.

## Rules

<!-- Add new rules below as design feedback lands. Group by topic. -->

### Layout & spacing

#### Compact, consistent spacing rhythm — never airy, never cramped

- **Rule:** Use a tight, predictable spacing scale (multiples of 4px). Inside cards/panels, prefer 12–16px padding. Between sibling rows in lists, 8–12px. Between major sections, 24–32px. Don't pad things to "make them breathe" — readable density beats luxurious whitespace. Equally, don't crush things together; consistency of rhythm matters more than absolute amount.
- **Why:** The aesthetic we like feels efficient and content-dense without feeling cluttered. That comes from rigorously consistent spacing, not from generous padding. Big asymmetric gaps and oversized padding make the UI feel marketing-y instead of tool-like.
- **How to apply:** When laying out a new surface, pick a single spacing scale (Tailwind's `space-2`/`space-3`/`space-4`/`space-6`/`space-8`) and stick to it. Avoid one-off values like `padding: 13px` or `gap: 18px`. If a section feels off, the fix is almost always picking a different *scale step*, not a custom pixel value.

#### Content fills the viewport edge-to-edge with a fixed left nav

- **Rule:** Default app shell is a thin persistent left sidebar (icons + short labels, ~220px wide or collapsed to ~56px) and a content area that uses the rest of the viewport. The content area itself uses internal padding and structure for hierarchy — don't constrain it with a narrow `max-w-3xl` reading column unless the surface is genuinely a long-form document. **No top-level page wrapper gets `mx-auto` + `max-w-*` (e.g. `max-w-[1320px]`, `max-w-7xl`, `max-w-screen-xl`).** That pattern centers the content and leaves empty gutters on wide displays — exactly the marketing-page silhouette this aesthetic rejects. On a workspace tool, every horizontal pixel between the sidebar and the viewport edge belongs to the content (tables, dense data rows) — not to symmetric whitespace.
- **Why:** This shell shape is what the aesthetic expects. Centered narrow columns with large empty side margins read as marketing pages, not as a workspace. A common failure: a detail page where `mx-auto max-w-[1320px]` caps a data grid and leaves wide-screen users staring at unused gutters while the table inside is cramped enough to need horizontal scroll. The right move is always to expand the content, never to throttle it.
- **How to apply:** New top-level pages slot into the existing app shell without introducing their own wrapper width — **no `mx-auto`, no `max-w-*` on the outermost content container**. Use internal padding (`px-6`/`px-8`) for breathing room from the viewport edges, and let cards/tables/panels stretch to fill the available width. Reserve `max-w-*` constraints for prose or forms *inside* a panel (e.g. a settings form capped at `max-w-xl`), not for the page itself. If you find yourself reaching for `max-w-[1320px]` "so the layout doesn't look stretched on a 4K monitor," push back: the fix is denser content or a multi-column layout, not a centered column with empty side gutters.

### Voice & copy

#### Sentence case for everything in the UI — not Title Case, not ALL CAPS

- **Rule:** Buttons, menu items, labels, headings, navigation entries, table headers — all use sentence case. "Add task," not "Add Task." "Recent activity," not "Recent Activity." Reserve Title Case strictly for proper nouns (product names, person names). Never use ALL CAPS for chrome (column headers, section labels, button text); allow it only for short status pills or programmatic identifiers like keyboard shortcuts.
- **Why:** Sentence case reads as natural language and makes the UI feel like it's talking *with* the user instead of shouting categories at them. Title Case and ALL CAPS belong to documents, brochures, and old-school admin tools — they break the calm, conversational tone the rest of the aesthetic establishes.
- **How to apply:** When writing or editing any UI string, default to sentence case. Capitalize only the first word and proper nouns. If the codebase has existing Title Case strings, don't mass-rewrite them, but don't add new ones either.

#### Plain, person-centered language — concise, direct, no jargon

- **Rule:** Write copy the way a thoughtful colleague would speak. Short sentences. Active voice. No system-speak ("Operation completed successfully"), no marketing puff ("Welcome to your dashboard!"), no scolding errors ("You must select a valid option"). Address the user as "you" and the system as "we" only when it adds warmth — usually neither is needed. Error messages explain what went wrong and what to do next, not what the user did wrong.
- **Why:** Copy is part of the design. Stiff, system-y, or marketing-y copy undermines the tool-like feel even when the visuals are right. The aesthetic depends on language that respects the user's time and intelligence.
- **How to apply:** When writing a button label, error message, empty state, or tooltip, draft it once, then cut it in half. Read it out loud — does it sound like a person? If not, rewrite. Empty state: one sentence + an optional action. Error: state the problem briefly, then the recovery path.

#### No cross-surface "consistency" disclaimers in the UI

- **Rule:** Do not add subtitles, tooltips, or parentheticals that tell the user a metric "matches" or "aligns with" another widget, page, or report (e.g. "matches other dashboard 30-day metrics," "same date range as the card above"). The visible string should only describe what *this* view measures and any time window in plain product terms.
- **Why:** That text is for implementers and reviewers, not end users. It clutters the interface and sounds like an internal note. Consistency between tiles and modals belongs in code, tests, and docs — not in user-facing copy.
- **How to apply:** If two surfaces must use the same window, encode that in shared constants and document it in engineering docs. For the UI, write a self-contained description (e.g. "in the last 30 days, through today") without referencing other parts of the app.

#### No explanatory subtitles under page headers — the page teaches itself through its content

- **Rule:** Don't add a descriptive paragraph under a page title (or section header) that narrates what the feature is and how it behaves — e.g. "Reusable requirement libraries. Instantiate one onto a client to generate their coverage requirements — later template edits don't change what's already on a client." A heading gets a plain label ("Coverage templates"); it does not get a mini-tutorial. If the model of a feature genuinely needs explaining, the interface itself should make it legible (column names, the shape of the table, an empty state, an inline hint at the exact moment a decision is made), not a standing block of prose the user reads once and never again.
- **Why:** These subtitles read like documentation someone pasted into the UI. They add visual weight at the top of every page, push the actual content down, and describe behavior the user learns far better by using the thing. The wordy "here's how this works" register is exactly the stiff, over-explaining tone the rest of the aesthetic avoids — it treats the user as if they can't infer meaning from a well-built screen. This pattern is specifically discouraged.
- **How to apply:** When adding a page or section header, give it just the label. Resist the urge to follow it with a sentence or two explaining the concept. If you feel the page is unclear without the paragraph, that's a signal the *layout* is under-communicating — fix that instead: name things precisely, design a helpful empty state, or surface a short hint contextually where the relevant action lives. A brief count or status line under a header (e.g. "12 templates") is fine; a conceptual explanation of how the feature works is not.

### Typography

#### Use a small type scale with tight line-heights and a single sans-serif family — err smaller

- **Rule:** Stick to one sans-serif (the system's chosen font; Inter or similar geometric sans). Prefer a noticeably small scale: ~11–12px (meta/labels/timestamps/table headers), **13px body (the default)**, 14–15px (section headings, only when a heading is needed), 16–18px (page title — rarely larger). Line-heights tight (1.3–1.45). Hard ceiling: nothing in app chrome above ~20px. Large display type belongs on marketing pages, not on tool UIs.
- **Why:** Smaller text is more comfortable and more tool-like. Defaults from most component libraries skew too large for this taste — when sizes feel "right out of the box," they're usually one step too big. Smaller type + tight rhythm signals "you're working here," not "we're showing off."
- **How to apply:** Default body to `text-[13px]` (or the closest token to 13px in the design system; `text-sm` ≈ 14px is the fallback). Page titles cap at `text-base`/`text-lg` — never reach for `text-xl` or above. Section headings are often the same size as body but with `font-medium` and a touch of muted color, rather than larger. When in doubt between two sizes, pick the smaller one.

#### Default size is small — but layouts must hold up when zoomed

- **Rule:** The *visual default* is small (per the rule above). Separately, the layout itself must be elastic enough that when a user zooms the browser to 125% (or has bumped up their OS text size), nothing breaks: no clipped text, no overflow, no horizontal scroll, no controls colliding. This means using token/`rem`-based sizes and flexible layouts rather than rigid pixel widths — *not* making the default bigger.
- **Why:** These are two separate concerns: (1) at default zoom the UI should feel small and tool-like; (2) when a user zooms (their choice, for their reasons) the UI should still be usable. A small default is the look; zoom-resilience is the safety net. Don't trade one for the other.
- **How to apply:** Keep the small defaults from the rule above. To stay zoom-resilient: prefer flexible layouts (flex, grid, `min-w-0`, `truncate` on long text), use `rem`/tokens rather than hard-coded pixels for things that should scale, and avoid fixed widths on text-bearing elements. If you spot a layout that would visibly break at 125%, fix the elasticity — don't fix it by inflating the default size.

#### Weight and color do most of the hierarchy work — not size

- **Rule:** Differentiate primary vs. secondary text with **weight** (regular vs. medium) and **color** (full-contrast foreground vs. muted) far more than with size. Body text is regular weight, full contrast. Labels and metadata are the same size or one step smaller, in a muted foreground (e.g. `text-muted-foreground`, ~60–70% contrast). Bold is reserved for emphasized values, not for headings of every section.
- **Why:** Pumping up font size to create hierarchy makes the UI loud. Using weight + color keeps the surface visually quiet while still being scannable.
- **How to apply:** Before bumping a heading to `text-xl`, try keeping it at body size with `font-medium` and `text-muted-foreground` for its surrounding metadata. The result is usually closer to the target aesthetic.

### Color

#### Mostly neutral surface; color appears only on meaning-bearing elements

- **Rule:** Backgrounds, borders, and most text live on a near-monochrome neutral palette (whites/light-grays in light mode; near-blacks/dark-grays in dark mode). Color (blue, green, amber, red, purple, etc.) appears **only** on elements that encode state, status, category, identity, or destination — status pills, priority markers, type chips, focused/selected states, links, and destructive confirmations. A screen at rest should be ~90%+ neutral by area.
- **Why:** Sparing color is what makes the colored elements legible at a glance. When everything is colored, nothing reads as meaningful. The aesthetic treats color as a signaling channel, not a decoration channel.
- **How to apply:** When adding a new component, default every surface, border, and text color to the neutral scale. Then ask: which one or two elements actually carry meaning a user needs to scan for? Color *only* those. If you're tempted to add a colored background "for visual interest," don't.

#### Subtle, low-saturation colors with paired tinted backgrounds for status

- **Rule:** Status/category colors are not pure saturated brand colors. They're slightly desaturated, paired with a very light tinted background (~5–10% opacity of the same hue) and a slightly stronger foreground for the label. E.g. an "in progress" pill is light blue background + medium blue text, not white text on a saturated blue fill. Borders, when used, are 1px and use a low-contrast neutral or a very light tint of the status color.
- **Why:** Saturated fills feel heavy and demand more attention than they deserve. Tinted-background pills sit calmly in the layout while still being instantly identifiable.
- **How to apply:** When building a status pill or badge, reach for `bg-{color}-50 text-{color}-700` (light mode) / `bg-{color}-950/40 text-{color}-300` (dark mode) rather than `bg-{color}-500 text-white`. Same for hover/selected row tints — soft, not loud.

#### A chip/pill fill must differ from the background it sits on in *every* state — including hover

- **Rule:** When a tag, chip, badge, or pill lives inside an element that changes background on interaction (a table row with `hover:bg-surface-muted`, a selectable list item, a hovered card), its fill must stay visibly distinct from that element's background in **all** states — resting *and* hover/selected. Don't give a neutral chip the same fill token the row uses for its hover (the classic bug: chip `bg-surface-muted` inside a row with `hover:bg-surface-muted` — the chip dissolves into the row the moment you hover). Check the full interaction, not just the resting frame.
- **Why:** A chip that vanishes on hover is invisible exactly when the user is pointing at that row — the worst moment to lose information. It's easy to miss because the resting state looks fine in a screenshot; the collision only shows up when you actually hover.
- **How to apply:** Reserve `surface-muted` for the row/hover background, and give neutral chips a fill that's a distinct step from *both* the resting and hover backgrounds. In this design system that's `bg-fill` (zinc-200 light / zinc-700 dark) — the one neutral token that sits clear of both `surface` and `surface-muted` in **both** themes. Note a 1px border does *not* rescue this in dark mode, where `line` and `surface-muted` are the same zinc-800 — so lean on the fill, not a border. Whenever you place a chip inside a hoverable container, mentally (or actually) hover it in both themes and confirm the chip is still legible. Chips in a static, non-interactive container (a header section that never changes background) can keep `bg-surface-muted` — the rule is specifically about interactive backgrounds.

#### Borders are 1px and low-contrast — never heavy dividers

- **Rule:** All borders/dividers are 1px (`border` in Tailwind), in a low-contrast neutral (`border-border`, `border-neutral-200`/`border-neutral-800`). No 2px+ borders. No black borders. Box-shadows are subtle (small offset, low opacity) or absent — most cards rely on a 1px border and a slightly different background, not a drop shadow.
- **Why:** Heavy borders and shadows make the UI feel boxed-in and dated. The target aesthetic uses hairline borders to define structure quietly.
- **How to apply:** Default to `border border-border` for cards/panels. Skip `shadow-md`/`shadow-lg` unless the element is genuinely floating (popover, dropdown, modal) — and even then prefer `shadow-sm` plus a border.

#### Light and dark themes are first-class peers — design both, never just retheme one

- **Rule:** Every surface, color, and component must work equally well in light and dark mode. Don't design only for one and "flip" colors. Tinted backgrounds for status pills need a dark-mode equivalent (e.g. `bg-blue-50/text-blue-700` ↔ `bg-blue-950/40 text-blue-300`). Borders, muted text, hover states, and focus rings must each have considered values in both themes — including being checked for contrast.
- **Why:** The user picks their theme; respecting that choice is non-negotiable. A surface that looks correct in light mode but washed-out, low-contrast, or jarringly bright in dark mode silently breaks the experience for half the users.
- **How to apply:** When introducing any color, define both light and dark values via design tokens or `dark:` variants. When self-auditing, toggle the theme and re-check the page — don't ship a feature you've only viewed in one mode.

### Components & composition

#### Inline `pt` / styling objects in the template — don't lift them into `<script setup>`

- **Rule:** When passing a `pt` object (PrimeVue / Volt) or any other static style/config object to a component, write it inline on the element in the template: `:pt="{ table: '...', column: { headerCell: '...' } }"`. Don't declare it as a `const tablePt = {...}` in `<script setup>` and reference it. Same for one-off prop objects that are pure styling (e.g. `:pt:root` shorthand, inline class maps). Only lift to the script when the object is genuinely reused across multiple elements *or* when it's computed from reactive state.
- **Why:** Two reasons. (1) **Tailwind only sees classes that appear in template source** — its JIT scanner extracts class names from template strings at build time. Classes hidden inside `<script setup>` JS strings (`const tablePt = { ... "bg-zinc-50" ... }`) may not be compiled into the CSS bundle until the JS executes, which can produce a flash of unstyled content. Inline `pt:section:class="..."` puts the classes where the scanner can find them. (2) It keeps the styling next to the markup it styles — the template should be readable top-to-bottom without bouncing into the script to resolve identifiers. Lifting static `pt` objects fragments where styling lives and mirrors a React pattern that doesn't fit Vue SFCs. This has come up repeatedly in code review on list and detail pages.
- **How to apply:** Default `pt` (and similar static config objects) inline. If the same `pt` is duplicated across 3+ elements, extract it — otherwise inline it, even if the object is large. Prefer `pt:section:class="..."` shorthand where the customization is a single section.


#### Cards are flat and structural, not visually elevated

- **Rule:** Cards are a 1px-bordered rectangle with a slightly different background from the page (or the same background, distinguished only by the border). No drop shadows. No gradient fills. No rounded corners larger than `rounded-md` (~6px) — `rounded-lg` (8px) at most. Internal layout uses dividers and spacing for structure, not nested mini-cards.
- **Why:** Heavily styled cards (big shadows, big radii, gradient headers) compete with content. Quiet, flat cards let the data inside read clearly.
- **How to apply:** When building a card, start from `border border-border rounded-md bg-background` and add only what's necessary. Avoid stacking multiple visual treatments (border + shadow + colored header).

#### Corner radii are consistent and feel continuous, not chiseled

- **Rule:** Pick a small set of radii and stick to them: ~4px for inputs/small chips, ~6–8px for cards/buttons, fully rounded (`rounded-full`) only for circular avatars and pill-shaped status badges. Nested elements should use a smaller radius than their container, never larger. Never mix sharp 0px corners with rounded ones in the same component family.
- **Why:** Consistent, gentle radii make the surface feel cohesive and modern; mixed radii (especially sharp + heavily rounded together) read as ad-hoc and dated. The eye reads softly-rounded shapes as friendlier without crossing into cartoonish.
- **How to apply:** Reach for the design system's radius tokens (`rounded-md`, `rounded-lg`, `rounded-full`). When nesting (a chip inside a card), step the inner radius down. Avoid one-off pixel values.

#### Layered surfaces use translucency and soft elevation, not hard drop shadows

- **Rule:** Floating elements — popovers, dropdowns, command palette, modals, sticky toolbars — are a layer *above* the content, and should read that way. Use a slight backdrop translucency (`backdrop-blur` + semi-opaque background, e.g. `bg-background/80 backdrop-blur-md`) plus a 1px border and a soft shadow (`shadow-sm` or `shadow-md` with low opacity). Modals dim the background with a low-opacity scrim (~30–50% black), not a hard black overlay.
- **Why:** Translucency and gentle elevation communicate spatial layering — "this is in front of that" — without screaming for attention. Hard shadows and opaque slabs flatten the hierarchy and feel heavy.
- **How to apply:** For any floating element, default to subtle translucency + thin border + soft shadow. For modals, use a translucent scrim and let the modal itself sit on a slightly elevated surface tint. Skip dramatic shadows.

#### Icons share a single style, are sized to the text, and align optically

- **Rule:** Use one icon set per project (e.g. Lucide, Phosphor, Heroicons — pick one). Inline icons next to text are sized to match the text's cap height (typically 14–16px next to body text, 12px next to small labels), use the same stroke weight, and are vertically centered with the text optically (sometimes a 1px nudge). Don't mix icon families. Don't use filled and outlined variants of the same icon arbitrarily — pick one variant convention (e.g. outlined by default, filled for "selected" or "active" states).
- **Why:** A consistent icon family with matched optical weight is a huge, near-invisible quality signal. Mixed sets, mismatched stroke weights, or inconsistent fill conventions make a UI feel patched together.
- **How to apply:** Standardize on a single icon library at the project level. When placing an icon next to text, size it via `h-4 w-4` (or matching the line-height). If the optical alignment is off by a hair, adjust with a small `translate-y` rather than padding. Never import icons from a second library "just for this one icon."

#### Don't use avatars or initials as decoration — only when they aid identification

- **Rule:** Avatars and initials circles earn their place only when they help the user identify a person at a glance — e.g. a comment thread with multiple participants where the avatar is the primary identifier, a header where space is tight and the photo replaces the name, or a list scanned by face rather than text. Do **not** put an initials bubble next to every row when the row already shows the person's full name and metadata. Same for type chips/letters next to entity names that already read clearly.
- **Why:** A grey circle with a person's initials next to their full name adds no information and pulls visual weight away from the data the user is actually scanning. A common failure: a detail page where every labor row renders an initials disc next to the person's name + tenure + status pill — the disc carries zero signal and crowds the row. Decorative avatars also imply "this is a social/people-y product" when the surface is actually a workspace tool.
- **How to apply:** Before adding an avatar/initials element, ask: "if I removed this, would the user lose information?" If the name is right next to it, the answer is no — drop the disc. Reserve avatars for surfaces where identity is the primary scan target (assignee column in a dense list with no name, comment authorship, presence indicators), not for every list that happens to involve people.

#### List pages show a total record count

- **Rule:** Any page whose primary job is to present a list or table of records shows the total number of records in the view — **as a bare number rendered right next to the page title, never in a table footer.** The preferred form is the count sitting immediately after the `<h2>` title: a baseline-aligned, muted `tabular-nums` span showing *just the number* (`Clients` then `3`) — **not** "3 clients", and **not** a `<tfoot>` "N clients" summary row. If a list page already has a `<tfoot>` total (record count and/or aggregate sums like "total active projects"), remove the whole footer and move the record count up next to the title; footer-only aggregate sums can be dropped unless the user asks to keep them. The count reflects what's actually in view: when filters or search narrow the set, the number updates to the filtered total (optionally "12 of 47" when a filter is active). Keep it low-key — small, muted type — not a hero stat.
- **Why:** On a list surface the size of the collection is first-order information: it tells the user whether they're looking at 8 things or 800, whether a filter did anything, and whether a page finished loading. Leaving it out makes the user scroll or guess. The count as a number by the title is preferred over a footer summary row — the footer buries the fact at the bottom where it's found only after scrolling, and repeats the entity noun the title already states. It's cheap to render and it's the kind of small competence signal that makes a tool feel trustworthy. This is the concrete form of the "a brief count under a header is fine" allowance above — on list pages it's not just allowed, it's expected.
- **How to apply:** Put the count inline with the title as part of the header treatment. The pattern in this stack (Nuxt/Volt/Tailwind):
  ```vue
  <div class="flex items-baseline gap-2">
    <h2 class="text-base font-medium text-fg">Clients</h2>
    <span class="text-[13px] tabular-nums text-fg-muted">{{ clients.length }}</span>
  </div>
  ```
  Derive it from the same data the list renders (`items.length`, or the server's total for paginated sets — show the server total, not just the current page's slice). Muted meta styling so it supports the title without competing. Sentence case, no ALL CAPS. Don't add it to detail pages or dashboards that merely happen to contain a small list — this is for pages that *are* a list. This came up across a set of list pages (clients, projects, subcontractors, certificates, coverage-templates): each had a `<tfoot>` "N records" row plus aggregate sums; the ask was to render the total as a number by the title instead — footers removed, count moved into the header.

#### Inline editing and hover-revealed actions over big edit/save buttons

- **Rule:** Where it makes sense, let users click a value to edit it in place rather than opening a modal or routing to an edit page. Row-level actions (edit, delete, archive) appear on hover or via a `…` menu, not as always-visible button columns crowding every row.
- **Why:** This is core to the tool-like feel. Persistent action buttons next to every value make lists feel cluttered and form-like; inline edit + hover actions keep the surface calm and let content dominate.
- **How to apply:** For editable fields on detail pages and rows, prefer click-to-edit. For bulk row actions, use a hover-revealed action group or a per-row `…` (kebab) menu. Reserve always-visible buttons for the one or two primary actions of the surface.

#### Every interaction gets immediate visible feedback

- **Rule:** The moment a user acts, the UI must respond — within the same frame if possible. Pressed states on buttons (slight darken or scale, not just color), hover states on every clickable surface, optimistic UI updates for ordinary mutations (toggling a checkbox, renaming a field), an inline check or subtle highlight when a save completes. If a network call takes more than ~200ms, show a quiet inline spinner or skeleton in the affected region — not a global loading bar.
- **Why:** This is the deepest part of the aesthetic: the UI feels *alive* because it acknowledges every input the moment it happens. Lag without feedback makes users tap twice, doubt themselves, or abandon the action.
- **How to apply:** For every interactive element, define `:hover`, `:active`/`:pressed`, `:focus-visible`, and (for toggles/checkboxes) the transitioning state. For mutations, update local state optimistically and reconcile with the server response — only roll back visibly if the request fails. For ≥200ms work, place the loading indicator inside the affected region.

#### Hit targets are forgiving — at least 32×32px on desktop, 44×44px where touch is plausible

- **Rule:** Every clickable element has a hit area of at least 32×32px on desktop and 44×44px when touch is plausible (mobile, tablet, hybrid devices). Small visual elements (a 16px icon-only button, a 12px close X, a row chevron) get expanded hit areas via padding or `::before` overlays — *the visual stays small, the click area is generous*. Adjacent interactive elements have at least 4px of space between their hit areas so the user doesn't trigger the wrong one.
- **Why:** Forgiving hit targets are an invisible accessibility win: they help everyone, especially users with motor differences, on trackpads, on touch screens, or just moving fast. Tiny hit areas force precision and breed missed clicks.
- **How to apply:** When rendering an icon-only button or a small chip, make sure the *containing button* has padding that brings the total tappable area to at least the minimum. Don't rely on the icon's pixel size as the hit target.

#### Keyboard-first interactions: command palette, shortcuts, and focus rings

- **Rule:** Every app should have (or grow toward) a global command palette (Cmd/Ctrl+K) for navigation and common actions. Common actions in a view should have keyboard shortcuts surfaced in tooltips and menus (e.g. `E` to edit, `C` to create). Focus rings must be visible and consistent — never `outline: none` without a replacement.
- **Why:** The aesthetic is built around power users who keep their hands on the keyboard. Mouse-only UIs feel slow and unfinished.
- **How to apply:** When adding a primary action, also wire a keyboard shortcut and show it in the tooltip/menu using a small `<kbd>`-styled chip. When adding a new top-level surface, register it in the command palette. Never strip default focus rings without replacing them with an equivalent visible indicator.

#### Motion is subtle, fast, and purposeful

- **Rule:** Transitions are short (100–200ms) and use ease-out timing. Animate opacity, transform, and color — not layout-affecting properties like width/height (use `auto`-height tricks sparingly). No bouncy springs, no decorative animations. Hover states transition color in ~120ms; modals/popovers fade+slide in ~150ms.
- **Why:** Motion in this aesthetic exists to soften state changes and confirm interactions, not to entertain. Long or playful animations feel out of place.
- **How to apply:** Default Tailwind `transition-colors duration-150 ease-out` on interactive elements. Reach for `framer-motion` (or equivalent) only for things like list reordering or popover entrance, with conservative durations.

#### Motion communicates spatial origin and respects "reduce motion"

- **Rule:** When a panel, popover, sheet, or modal appears, it should animate from a position that suggests where it came from — a dropdown grows from its trigger, a side sheet slides in from the edge it's anchored to, a modal fades+scales subtly from the page. Don't have things appear from nowhere or fly across the screen. Honor `prefers-reduced-motion`: when set, replace transforms/slides with simple opacity transitions or instant state changes.
- **Why:** Spatially anchored motion reinforces hierarchy and continuity (depth) — the user understands what came from where without thinking. And users who set "reduce motion" do so for real reasons (vestibular disorders, focus); ignoring that preference causes harm.
- **How to apply:** Tie entrance animations to the trigger's origin (transform-origin, anchored slide direction). Wrap non-essential motion in a `@media (prefers-reduced-motion: reduce)` guard or equivalent runtime check, falling back to fade or no animation. Never animate purely decorative things (background gradients, idle pulses) without a reduce-motion fallback.

### Forms & inputs

#### Compact, single-column forms with quiet inputs

- **Rule:** Form inputs are compact (height ~32–36px), 1px-bordered, with a subtle background that's the same as or only slightly different from the surface. Labels are small, muted, and sit above the input (not floating, not inside). Forms default to single-column unless the fields are clearly grouped pairs (e.g. start/end date). Help text is small and muted, beneath the input.
- **Why:** Tall, heavily-styled inputs with floating labels feel form-tower-y and consumer-app-y. Compact, quiet inputs match the tool-like aesthetic and let users move through fields fast.
- **How to apply:** Use the design system's default input size (don't bump it up). Label above, regular weight, muted color. One column unless there's a real reason for two. Skip inline icons inside inputs unless the icon adds clear meaning (e.g. a search magnifier).

#### Inputs in flex/grid cells must stretch to fill — `w-full min-w-0` on the input, `min-w-0` on the cell

- **Rule:** When placing an input (text, select, date, etc.) inside a flex column or grid cell, give the input `w-full min-w-0` (via `pt:root:class` for Volt/PrimeVue components) and the parent cell `min-w-0`. Don't rely on the input's intrinsic ~20ch browser-default width to "happen to fit." For multi-column rows (e.g. city / state / zip), define explicit grid track sizes (`grid-cols-[1fr_110px_96px]`) and let inputs fill each track.
- **Why:** Inputs render at their native size by default and ignore their grid/flex track width. In constrained surfaces — especially modals — that pushes the layout past the container and triggers horizontal scroll. Min-width defaults on flex/grid items compound the problem. A common failure: a "new record" modal that scrolls side-to-side because each input claimed its native width inside a ~480px dialog.
- **How to apply:** Every input inside a dialog, panel, or constrained surface gets `pt:root:class="w-full min-w-0"` (or `class="w-full min-w-0"` for native inputs). Each containing flex/grid cell gets `min-w-0`. For belt-and-braces in modals, `overflow-x-hidden` on the form is fine. Don't try to fix overflow by widening the dialog — fix the elasticity.

### Tables, lists, and data display

#### Dense, scannable rows with subtle row separation and hover states

- **Rule:** Lists and tables use compact rows (~36–44px tall), separated by 1px low-contrast dividers (or no dividers if zebra-striping is more appropriate — pick one, never both). Row hover is a subtle neutral background tint, not a colored highlight. Selected rows use a faint tinted background. Column headers are small, muted, regular-weight — not bold, not uppercase-tracked.
- **Why:** This is the table style that goes with the rest of the aesthetic. Tall rows with heavy dividers and bold uppercase headers read as old-school admin panels.
- **How to apply:** When building a table, start with the smallest reasonable row height, neutral hover tint (`hover:bg-muted/50`), 1px dividers between rows, and headers that look like body text but slightly muted. Add color only on status/priority/category cells, not on whole rows.

#### Grouped, collapsible sections instead of separate pages where possible

- **Rule:** Prefer surfacing related data in collapsible sections within the same view (with subtle headers and chevron toggles) over routing the user to multiple sub-pages. The default state is "the most relevant section open, the rest collapsed."
- **Why:** Keeping the user in one view with progressive disclosure feels faster and more workspace-like than a tree of nested pages.
- **How to apply:** When designing a detail surface, list the data the user might want and group it into 3–6 sections in one view. Implement section toggles instead of tabs/sub-routes unless the sections are genuinely independent flows.

#### Tabbed slices of one sorted list: preserve column sort; no archive framing; shared chips for counts

- **Rule:** If one dataset is shown across tabs (e.g. "Active" vs "Completed" / "Open" vs "Closed"), **do not reorder** the primary tab to group a subset at the bottom or re-sort that subset by a second key (e.g. "recently updated") when the user has already sorted by something meaningful (due date, name, etc.). Split by **walking the already-sorted list in order** and only moving overflow rows to the secondary tab. Use the project's **shared tag/pill component** for small counts beside tab labels — not a one-off `Box` with custom padding, radius, and font size. When a secondary tab is just **the same table or card list** with a different filter, **omit** titled "archive" panels, tinted intro banners, and explanatory body copy above the list — the tab name is enough; the body should read as **the same list component, different rows**. For "completed" or success-state rows/cards, prefer a **soft tinted background** on the whole row/card; avoid stacking extra structural decoration (e.g. a thick **left border accent** on cards) unless the rest of the product already uses that pattern consistently.
- **Why:** Reordering undermines the sort the user chose and breaks scan patterns. Ad-hoc count pills drift from the design system and add maintenance cost. Archive-style headers and instructional paragraphs add noise when the interaction is already obvious from the tab. Left-border + fill on the same card reads heavier than a tint alone and fights the "delicate, deference to content" baseline.
- **How to apply:** Implement split helpers that take the **display-ordered** array, identify which rows belong in each tab, and **filter without reshuffling** the primary tab relative to the active sort. For a React/MUI-style stack: tab counts use the shared neutral `Tag` component for secondary counts (a **stronger text + tinted background** on the tag when the primary tab's count should read as more prominent); tabs use the shared tabbed-view component. Completed styling: apply per-row completion styling from **state** (same treatment on every tab), not a boolean that styles an entire panel.

### Buttons & actions

#### Quiet button hierarchy: one primary, mostly subtle/ghost everywhere else

- **Rule:** A surface should typically have **one** primary (filled) button — the main action. Everything else is subtle (neutral filled, low contrast) or ghost (transparent with hover background). Destructive actions are subtle by default, with the destructive color appearing on hover or in the confirmation step — not as a giant red filled button on the page.
- **Why:** The aesthetic avoids loud calls-to-action. Multiple filled buttons on one screen flatten hierarchy and look like a marketing page.
- **How to apply:** When laying out actions on a page, identify the single primary and make only that one filled. Secondary actions get ghost or subtle styles. For destructive actions, prefer subtle styling on the page itself and let the confirmation modal carry the destructive color.

#### Buttons and controls are *small* — delicate, compact, never chunky

- **Rule:** Default button height is **~26–28px**, not 36px or 40px. Inputs, selects, segmented controls, and chips match: ~26–30px tall. Padding is tight (~8–10px horizontal, ~4–6px vertical). Radii are small (`rounded-md`, ~4–6px). Icon-only buttons are square at the same height (~26–28px box) with a 14–16px icon inside. Borders are 1px and low-contrast. Filled "primary" buttons get a single subtle background color, no gradient, no inner highlight, no shadow.
- **Why:** The preferred aesthetic reads as delicate and tool-like — controls sit quietly and don't dominate the layout. Default component-library button sizes (Tailwind UI, shadcn, PrimeVue defaults) are typically one or two steps too big for this; they feel chunky and consumer-app-y when shipped as-is.
- **How to apply:** Override the default size of every button/input/select to land in the 26–28px range. In shadcn-style libraries, prefer the `sm` (or even `xs`/custom) size variant for controls; in Tailwind, this is roughly `h-7` (28px) or `h-6` (24px) for the most delicate feel. Make sure the hit-target rule is still met via padding even when the visual is small.

#### Button labels are verbs that name the action — never "OK," "Yes," or "Submit"

- **Rule:** The label on a confirm/commit button names what will happen: "Delete project," "Send invite," "Save changes," "Move to archive." Avoid generic labels — no "OK," "Yes," "No," "Submit," "Confirm" by themselves. The cancel/dismiss button can stay as "Cancel" since its action is universal. In a confirmation dialog, the destructive button's label restates the action ("Delete 3 tasks"), not just "Confirm."
- **Why:** Specific button labels let users skim a dialog and act without reading the body text. Generic labels force the user back to the prose to understand what they're agreeing to.
- **How to apply:** When writing any commit-style button, ask "what does this *do*?" and put that verb phrase on the button. In confirmation modals especially, the action button always names the thing — never the verdict.

#### Disabled buttons explain why; better yet, don't disable — guide instead

- **Rule:** Avoid disabled buttons where possible. If an action isn't yet available, prefer keeping the button enabled and surfacing the missing prerequisite (a tooltip on hover, an inline hint near the relevant field) when the user tries — or better, just route them to fill in what's missing. When you must disable, the disabled state must be visibly distinct *and* the reason must be discoverable (tooltip on hover/focus).
- **Why:** A silently disabled button is a dead end. The user is left guessing what's wrong. Explaining the obstacle (or removing it) is more respectful and faster.
- **How to apply:** Before disabling, ask: can I instead let them click and then show the issue inline? If you must disable, attach a tooltip explaining the unmet prerequisite. Never disable without explanation.

### Empty states, loading, and errors

#### Empty states are short text + at most one action, no illustrations

- **Rule:** Empty states are a short, plainspoken sentence describing what the user sees and (optionally) one button to create the first item. No marketing illustrations, no large icons, no multi-paragraph onboarding copy. Same restrained voice as the rest of the UI.
- **Why:** Big illustrated empty states clash with the tool-like aesthetic. The user is a working adult; tell them what's here and what they can do.
- **How to apply:** Empty state pattern: muted, centered, ~1 sentence, optional single primary button. Use a small, simple icon at most — never a stock illustration.

#### Skeletons over spinners; inline error messages over toasts when in-context

- **Rule:** While data loads, show skeleton placeholders that match the final layout's shape (rows, cards). Reserve spinners for short imperative actions (button clicks). For errors caused by something on the current surface, render the error inline in that surface (e.g. a small destructive banner inside the panel that failed). Toasts are for global/transient feedback, not for surface-specific errors the user needs to see while fixing them.
- **Why:** Skeletons preserve layout and feel faster. Inline errors keep the user's context; toast-only errors disappear and force the user to remember what failed.
- **How to apply:** Build skeleton variants alongside loaded states. For each error path, decide: is this about *this* surface (inline) or about an action that's now over (toast)?

#### Successful mutations get a toast; form errors stay inline in the form

- **Rule:** When a create/update/delete succeeds, show a brief success toast (e.g. `severity: "success"`, `life: 3000`, summary names what happened, detail names the affected entity — "Client created" + the company name). Mount the toast container **once in the default layout** (`<VoltToast position="bottom-right" />`), not per-page. Errors that the user needs to fix in a still-open form (validation, server rejection) render **inline** in the form — never as a toast that disappears while they're correcting the field. Toasts are for "this is now done" feedback; inline messages are for "fix this and try again."
- **Why:** Success toasts give the immediate confirmation users need ("did that actually save?") without blocking the next action. But surface-specific errors in toasts vanish before the user has fixed the input, forcing them to remember what went wrong. Splitting the two channels — toast for completion, inline for in-context errors — is what makes mutations feel both responsive and forgiving.
- **How to apply:** In layouts, mount `<VoltToast position="bottom-right" />` once. In pages with mutations, `import { useToast } from "primevue/usetoast"` and `const toast = useToast()`. On success: close the dialog, refresh the data, then `toast.add({ severity: "success", summary, detail, life: 3000 })`. On error: keep the dialog open, render the message inline near the form (`<p class="text-[12px] text-red-600">`). Use the API-returned entity in the toast detail when possible — confirms the server actually persisted what the user typed.

#### Confirmations are reserved for irreversible actions; everything else gets undo

- **Rule:** Don't put a confirmation modal in front of an action that can be undone. Delete a row → soft-delete + show a toast with an "Undo" button for ~5–8 seconds. Archive, mark-as-done, dismiss → same. Reserve confirmation modals for actions that genuinely cannot be reversed: hard deletes of large datasets, sending an external email/payment, publishing something irreversibly. When you do show a confirmation, the body explicitly states what will happen (and to how many things), and the action button names the action ("Delete 12 invoices"), not "Confirm."
- **Why:** Reflexive confirmations train users to dismiss dialogs without reading them. Undo respects user intelligence and is faster for the common case (the action was correct) without punishing the rare mistake.
- **How to apply:** When wiring a destructive action, default to: act immediately + show toast with undo. Only escalate to a confirmation modal if the action can't actually be undone. When you do confirm, count and name the affected items in the message.

### Responsive & mobile

#### Desktop-first; mobile is "still usable," not "rebuilt"

- **Rule:** These apps are primarily desktop tools. Pages should work on smaller screens (no horizontal scroll, no overflow), but don't redesign the experience for mobile unless the app is genuinely mobile-first. Sidebars collapse, tables scroll horizontally inside their container, dense rows stay dense.
- **Why:** Engineering effort spent rebuilding desktop tool UIs as full mobile experiences is usually wasted — the workflows aren't mobile-shaped. "Still usable on a laptop with narrow window or a tablet" is the right bar.
- **How to apply:** Test new pages at narrow widths and confirm nothing overflows or breaks. Don't ship separate mobile-only layouts unless explicitly asked.

### Accessibility

#### Visible focus rings, sufficient contrast, and semantic structure are non-negotiable

- **Rule:** Every interactive element has a visible focus ring (the design system's default is fine — don't override). Text/background contrast meets WCAG AA in both light and dark themes (muted-foreground on background should still be readable). Use real semantic elements (`<button>`, `<a>`, `<label>`-bound inputs, headings in order) rather than `<div>`-with-onclick.
- **Why:** A keyboard-first aesthetic only works if the keyboard actually works. Stripping focus styles or shipping low-contrast muted text breaks both keyboard and screen-reader users.
- **How to apply:** Never write `outline: none` without a replacement. When using a muted color, eyeball it against its background — if it's borderline in light mode, it's probably worse in dark mode. Reach for the right element, not a styled `<div>`.

## Self-audit checklist (run before finalizing)

- [ ] Opened the page in a browser (not just confirmed it compiles) and looked at the actual rendered UI.
- [ ] **Toggled both light and dark mode** and confirmed the surface looks correct in both — no washed-out or jarring values.
- [ ] Spacing is consistent with neighboring surfaces — no cramped or oddly-padded sections.
- [ ] Typography uses the established scale; no ad-hoc font sizes or weights.
- [ ] All UI strings are in **sentence case** (no Title Case, no ALL CAPS chrome).
- [ ] Copy is plain, concise, and person-centered; no system-speak or marketing fluff.
- [ ] Colors come from the design system / theme tokens; no hard-coded hex values that don't match a token.
- [ ] Icons all come from the same library, are sized to text, and are optically aligned.
- [ ] Buttons match the variants used elsewhere in the repo (primary/secondary/text/destructive).
- [ ] **Button labels name the action** (no "OK," "Submit," "Confirm" alone).
- [ ] Hit targets are at least 32×32px (desktop) / 44×44px (touch); small visuals have expanded tap areas.
- [ ] Every interactive element has visible hover, pressed, and focus-visible states.
- [ ] Mutations feel immediate — optimistic UI where appropriate; spinners only for >200ms work.
- [ ] **Destructive actions use undo (toast) by default**; confirmation modals only for genuinely irreversible actions, with action button naming the action.
- [ ] No disabled buttons without an explanation (tooltip or inline hint).
- [ ] Floating elements (popovers, modals, sheets) animate from a sensible spatial origin and respect `prefers-reduced-motion`.
- [ ] Empty, loading, and error states are present where the user could plausibly hit them.
- [ ] Layout doesn't break at common widths (narrow sidebar, full-width, mobile if the app supports it).
- [ ] Real semantic elements used (`<button>`, `<a>`, `<label>`, headings in order) — not styled `<div>`s.
- [ ] Re-read every rule above and confirmed compliance.
- [ ] If a rule was violated, fixed the code — didn't just note it.
- [ ] If this task surfaced a *new* lesson worth saving, flagged it so it can be added.
- [ ] If the UI uses **tabs over slices of one sorted list**, confirmed the primary tab **preserves the chosen column sort** (no silent regrouping) and tab counts use the **shared tag/chip** — not bespoke count styling.
- [ ] Secondary tab bodies that are "more of the same list" have **no archive-style header or instructional copy** unless the product explicitly needs onboarding there.
</content>
</invoke>
