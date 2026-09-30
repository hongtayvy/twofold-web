# Build Prompt — Twofold Web App (twofold-app)

**Goal:** Build out the Twofold web app UI at **~99% visual and behavioral fidelity** to the **Ritual** landing concept (`landing-concepts/twofold-ritual.html`). The landing page sells the product; the app *is* the product — so carry the exact same design language, tokens, type rules, color story, radius system, and motion into every app screen. When a detail is unspecified below, open `twofold-ritual.html` and copy what it does. That file is the source of truth.

---

## 0. Fidelity bar

- Treat `landing-concepts/twofold-ritual.html` as the canonical design spec. Reuse its exact hex values, font stack, radius scale, spacing rhythm, and motion timings — do not re-derive or "improve" them.
- The app should feel like the same product a returning visitor already met on the landing page: same paper background, same serif headings, same money-as-designed-object numerals, same jade-only buttons.
- Any deviation must be justified by a genuine app need (density, interactivity) — never by taste drift.

---

## 1. Product thesis (drives layout priority)

Twofold is a **couples-focused personal finance app** built around a calm, recurring rhythm — not a dashboard arms race. The organizing metaphor is a **week**: the app quietly watches Monday–Saturday, and the couple shows up on **Sunday** for a five-minute recap that ends in a shared decision. Therefore:

- The **Sunday recap** is the app's hero object, not the accounts screen. Give it the most design care.
- Everything is scoped to a **household** (two partners, one household ID). Shared state syncs live between them.
- The color system encodes the relationship: one partner is jade, the other apricot, and what they share is the overlap. This is product meaning, not decoration.

---

## 2. Design tokens (copy verbatim into Tailwind config)

```js
tailwind.config = {
  theme: {
    extend: {
      colors: {
        paper: '#FAFAF7',   // app background
        ink:   '#18211C',   // primary text
        mute:  '#5C6862',   // secondary text
        line:  '#E5E9E4',   // hairline borders / dividers
        jade:    { 50:'#EFF7F2', 100:'#DEEFE5', 200:'#C2E2D0', 400:'#7CBC9E', 500:'#55A183', 600:'#3B8168', 700:'#2E6552', 900:'#122B21', 950:'#0B1F17' },
        apricot: { 50:'#FDF4EC', 100:'#FAE7D6', 200:'#F3CFB1', 400:'#E3A377', 500:'#CE8352', 600:'#A96536', 700:'#88512C' },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],   // headings
        body:    ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        num:     ['"DM Mono"', 'ui-monospace', 'monospace'],   // ALL money figures
      },
    },
  },
};
```

Load exactly these Google Fonts: `DM Serif Display` (400), `DM Sans` (opsz 9..40, 300..700), `DM Mono` (400;500). Icons: **Phosphor Icons** (`@phosphor-icons/web`), matching the landing page.

**Surface & depth rule:** No shadows, no gradients. Depth comes only from `paper` vs `white` layering and 1px `line` borders. Sections that need emphasis use `bg-white` with `border-y border-line`; the app's default canvas is `paper`.

---

## 3. Color-as-story rules (non-negotiable)

- **Jade is the action color.** Every button, primary CTA, active/selected state, and interactive affordance is jade (`bg-jade-600`, hover `bg-jade-700`; text-on-light `text-jade-700`). Nothing else is ever a button color.
- **Apricot is the second partner's identity color only.** Apricot **never** appears on a button or as an action.
- **The overlap = "Ours."** Shared items read in a soft olive/neutral that comes from the two-circle multiply mark, or simply the jade family for shared totals — never apricot-on-a-button.
- **Categorization is gender-neutral: Mine / Yours / Ours.** Map the two partners to the two hues by household membership, not by gender. Show each partner by their own name/initials + their assigned hue. (The landing sample uses names "Jon"/"Maya"; in the real app the labels are the two members' names and the neutral **Mine/Yours/Ours** buckets.)
- **Brand mark:** two overlapping circles — apricot circle + jade circle with `mix-blend-mode: multiply`, giving the olive overlap. Reuse the `<symbol id="mark">` SVG from the landing file.

---

## 4. Typography rules

- **Headings: `DM Serif Display`, weight 400 ONLY.** It ships a single weight — never apply `font-bold` (it fakes a smeared bold). Set `font-synthesis-weight: none`. **Hierarchy comes from size, not weight.** Match the landing scale, e.g. section H2 ≈ `text-3xl md:text-[2.5rem] tracking-tight leading-[1.1]`.
- **Body: `DM Sans`.** Normal weights for prose, labels, nav.
- **Numerals: `DM Mono` for EVERY money figure** — balances, transaction amounts, goal totals, contributions. Use `font-variant-numeric: tabular-nums` (`.num`) so decimals align. Treating numbers as designed objects is the core fintech craft tell; do not render money in DM Sans.
- Apply `font-synthesis-weight: none` to DM Mono too.

---

## 5. Component system (build these as reusable React/TS components)

Match the landing page's exact treatments:

- **Radius scale (one system, no exceptions):** cards `20px` (`rounded-[20px]`), pills/buttons `rounded-full`, inputs `12px` (`rounded-xl`).
- **Primary button:** `btn-press inline-flex items-center rounded-full bg-jade-600 text-white font-medium px-8 py-4 hover:bg-jade-700 transition-colors`. Small variant `px-5 py-2.5 text-sm`. `.btn-press:active { transform: translateY(1px) scale(.985); }`.
- **Secondary button:** white with `border border-line`, `text-ink`, `hover:bg-paper`. Never apricot.
- **Card:** `rounded-[20px] bg-white border border-line p-6 md:p-7` on a `paper` canvas (or `bg-paper` card on a white section — invert to keep contrast).
- **Input:** `rounded-xl border border-line` 12px radius, `bg-white`, focus ring in jade.
- **Nav:** `sticky top-0 z-50 bg-paper/90 backdrop-blur border-b border-line`, wordmark + brand mark left, jade CTA right; mobile menu for small screens with proper `aria-expanded`/`aria-controls`.
- **Transaction row:** avatar/hue dot (jade or apricot per owner) + merchant (DM Sans) + amount (DM Mono, tabular). Use the `.txn` land animation (see §6).
- **Presence indicator:** small hue dot / avatar showing which partner is currently viewing or editing (real-time). Jade = one partner, apricot = the other.
- **Goal / contribution bar:** horizontal stacked bar showing each partner's contribution in their hue toward a shared target — the palette doing real work. Amounts in DM Mono.
- **FAQ/disclosure:** `details/summary`, no default marker, a Phosphor `+` icon that rotates 45° on open with the standard cubic-bezier.

---

## 6. Motion (MOTION_INTENSITY 5 — purposeful, not decorative)

Reuse the landing page's motion primitives exactly:

- **`.reveal`** — elements start `opacity:0; translateY(14px)`, transition to visible via IntersectionObserver adding `.is-visible`. Timing `.7s cubic-bezier(.16,1,.3,1)`. Stagger siblings with `transition-delay`.
- **`.txn` land animation** — transactions "land" one by one on entry, staggered by `--i` (`calc(var(--i) * 130ms)`), `land .55s cubic-bezier(.16,1,.3,1) forwards`. This is the one signature motion idea — money arriving through the week. Use it wherever a list of new activity appears.
- **`.btn-press`** — tactile press on all buttons.
- **Reduced motion:** honor `@media (prefers-reduced-motion: reduce)` — kill animations, show content in final state. Copy the guard block from the landing file.
- Real-time updates (new transaction synced from partner) should use the same land motion so live data feels native, not jarring.

---

## 7. App screens to build (map the landing narrative into product)

Build a cohesive, mobile-first SPA. Prioritize in this order:

1. **Auth** — Login + Signup (Supabase email/password). Paper canvas, serif heading, single jade CTA, brand mark. Calm, minimal.
2. **Household onboarding / Invite flow** — create or join a household; generate/send an invite; accept binds both users to one household ID. This is core to the couples concept. Show the two-circle mark forming as the second partner joins.
3. **Home / The Week** — the app's spine. A 7-day strip (like the landing "Week" grid) showing the week's rhythm; quiet Mon–Sat, Sunday highlighted. Live activity lands here.
4. **Sunday Recap (hero screen)** — the centerpiece. A focused card summarizing the week for both partners that **ends in a shared decision** (e.g. "Move it" / "Leave it" jade + secondary buttons). Give this the most polish.
5. **Accounts — unified snapshot with Mine/Yours/Ours** — all accounts in one view, neutral Mine/Yours/Ours labeling by hue, balance history drill-down, manual account entry. Money in DM Mono.
6. **Transactions** — live-syncing list using the land animation; owner hue dots; filter by Mine/Yours/Ours.
7. **Goals** — joint goals with two-color stacked contribution bars, target amount + date + progress.
8. **Three Lanes / Privacy** — mine / shared / yours model made visible (shared lane dominant — shared is the point). "Together is not the same as transparent."
9. **Debt payoff (avalanche)** — visualization of avalanche payoff with joint progress, in the same visual language.
10. **Settings / Trust** — connection status, household members, the "We can watch, we cannot touch" read-only-access framing.

Reuse landing **copy voice** (calm, plain, second-person, short serif statements) for empty states and headers. All product figures in mockups are sample data — wire real data via the API.

---

## 8. Tech constraints

- **Stack:** React + TypeScript, Tailwind (config above). Port the landing page's raw CSS animations into the app (global stylesheet or CSS modules) — keep class names (`.reveal`, `.txn`, `.btn-press`, `.num`) so behavior matches.
- **Auth + data:** Supabase (auth + Postgres). Backend is Java Spring Boot **WebFlux**.
- **Real-time:** WebSocket connection **scoped per household ID**; presence indicators for who's viewing/editing; optimistic locking on concurrent edits. New/changed data animates in with `.txn` land. (No CRDT in alpha.)
- **Hosting target:** Cloudflare Pages (app: twofoldfinance.app). Keep the build Pages-compatible.
- **Repos:** this is `twofold-app`. Marketing site is `twofold-web`; API is `twofold-api`.
- **Deferred — do NOT build into alpha:** Plaid, Stripe, native apps, CRDT. Use manual account entry.
- **Accessibility:** WCAG AA contrast on jade/apricot text pairings, full keyboard nav, `aria-*` on nav/disclosure/dialogs, visible focus states in jade.

---

## 9. Acceptance checklist (the "99%" test)

Before considering a screen done, verify against `twofold-ritual.html`:

- [ ] Background `#FAFAF7`, text `#18211C`, hairlines `#E5E9E4`.
- [ ] Every heading is DM Serif Display **400** (no fake bold), sized for hierarchy.
- [ ] Every money figure is DM Mono, tabular, decimals aligned.
- [ ] Every button is jade; apricot appears only as partner identity, never on an action.
- [ ] Cards 20px, buttons pill, inputs 12px — no other radii.
- [ ] No shadows, no gradients; depth via paper/white + 1px lines.
- [ ] `.reveal` on scroll, `.txn` land on new activity, `.btn-press` on buttons; reduced-motion respected.
- [ ] Mine/Yours/Ours is gender-neutral and hue-coded per household member.
- [ ] Shared/real-time state scoped to household ID with presence shown.
- [ ] Brand mark = two overlapping circles (apricot + jade multiply).

**When in doubt, open `twofold-ritual.html` and match it.**
