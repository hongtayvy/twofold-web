---
name: twofold-feature-builder
description: >-
  Pull the next feature from the Twofold "Dev Work Board" in Notion and build it
  end-to-end at ~99% fidelity to the Ritual design system, then update the card.
  Use when the user says things like "work on the next twofold feature", "pull
  from the dev board", "build the next card", "work the board", "what's next on
  twofold", or names a specific board card to implement.
---

# Twofold Feature Builder

Read the **Dev Work Board** in Notion, pick the next feature to work on, implement it to
spec, verify it, and move the card forward. This skill is the loop that lets Twofold be
built card-by-card without re-explaining the product or the design system each time.

## Prerequisites

- The **Notion MCP** is connected (so this session can read/update the board).
- These design references exist in the repo (copy them in if missing):
  - `design/twofold-app-build-prompt.md` — the full build spec + acceptance checklist.
  - `design/twofold-ritual.html` — the canonical design source of truth (exact tokens, type, motion).
- The repo's `CLAUDE.md` carries the design hard-rules (see below). Keep it in sync.

## The board

- **Database:** "Dev Work Board" — https://app.notion.com/p/4af529878831419f9fad3807c6c6d8f8
- **Data source id:** `181094c5-d0f7-4ac4-842d-c7ebfb9d150d`
- **Columns:** `Feature` (title), `Repo` (twofold-web | twofold-app | twofold-api | other),
  `Priority` (low | medium | high), `Status` (Not started | In progress | Done),
  `Cycle` ("This week" or blank), `Notes` (what + why + dependencies).

## Workflow

1. **Pick the card.** If the user named one, use it. Otherwise query the board for
   `Status = "Not started"` and choose by: `Cycle = "This week"` first, then `Priority`
   high → medium → low. Skip `low`-priority cards whose Notes say "deferred to post-alpha"
   (Plaid, Stripe, native apps, CRDT) unless the user explicitly asks for one. Show the
   chosen card (Feature, Repo, Priority, Notes) and confirm before building.
2. **Check the repo.** The card's `Repo` says where the work goes. If it doesn't match the
   repo this session is running in, say so and ask the user to run the skill from that repo
   (or switch), rather than building in the wrong place.
3. **Claim it.** Update the card's `Status` to `In progress`.
4. **Load context.** Read `design/twofold-app-build-prompt.md`, `design/twofold-ritual.html`,
   and `CLAUDE.md` before writing any UI. When a visual detail is unspecified, open the
   Ritual HTML and match it exactly — do not re-derive tokens.
5. **Plan, then build.** Enter plan mode, lay out the change, get approval, then implement.
   Keep the class names from the landing page (`.reveal`, `.txn`, `.btn-press`, `.num`) so
   motion and numerals behave identically.
6. **Verify** against the checklist below (and §9 of the build prompt). For UI work, run the
   dev server, screenshot the affected route, and compare it to `twofold-ritual.html` —
   catch fake-bold serifs, wrong radii, apricot-on-buttons, and money not in DM Mono.
7. **Close the loop.** Append to the card's `Notes` a one-line summary of what shipped
   (and any follow-ups), then set `Status` to `Done` if fully complete, or leave it
   `In progress` with a note if partial. Commit on a feature branch; open a PR if that's
   the team's flow. Never mark `Done` with failing tests or an unmet checklist.

## Product rules (always apply)

- Twofold is a **couples** finance app organized around a **weekly rhythm**: quiet Mon–Sat,
  a five-minute **Sunday recap** that ends in a shared decision. The Sunday recap is the
  hero object — give it the most care.
- Everything shared is scoped to a **household id** (two members, one household). Shared
  state syncs live via **WebSocket per household**, with **presence indicators** and
  optimistic locking on concurrent edits. No CRDT in alpha.
- Categorization is **gender-neutral: Mine / Yours / Ours** — mapped to the two members by
  household membership, never by gender. Use members' real names/initials, not the sample
  "Jon/Maya" from the concept file.
- **Deferred — do not build into alpha:** Plaid, Stripe, native apps, CRDT. Use manual
  account entry.
- Stack: React + TypeScript (twofold-app), Java Spring Boot WebFlux (twofold-api), Supabase
  auth + Postgres, Cloudflare Pages, Render (API).

## Design hard-rules (the "99%" bar)

Copy these into `CLAUDE.md` too so they persist across sessions.

- **Palette:** paper `#FAFAF7`, ink `#18211C`, mute `#5C6862`, line `#E5E9E4`.
  Jade scale = one partner **and the only action/button color** (`bg-jade-600`, hover
  `bg-jade-700`, text-on-light `text-jade-700`). Apricot scale = the other partner's
  identity **only — never on a button or action**. Overlap = "Ours".
- **Type, three strict roles:** headings `DM Serif Display` **weight 400 only**
  (`font-synthesis-weight: none`; hierarchy by size, never `font-bold`); body `DM Sans`;
  **every money figure `DM Mono`, tabular-nums** (`.num`). Icons: Phosphor.
- **Radius:** cards `20px`, buttons/pills `rounded-full`, inputs `12px`. No other radii.
- **Surface:** no shadows, no gradients. Depth via paper/white layering + 1px `line` borders.
- **Motion (purposeful):** `.reveal` on scroll, `.txn` land-stagger for new/live activity
  (`--i * 130ms`), `.btn-press` on buttons; honor `prefers-reduced-motion`.
- **Brand mark:** two overlapping circles (apricot + jade, `mix-blend-mode: multiply`).

## Verification checklist (gate before "Done")

- [ ] Background `#FAFAF7`, text `#18211C`, hairlines `#E5E9E4`.
- [ ] Headings are DM Serif Display 400 (no fake bold), sized for hierarchy.
- [ ] Every money figure is DM Mono, tabular, decimals aligned.
- [ ] Every button/action is jade; apricot is identity-only, never an action.
- [ ] Cards 20px, buttons pill, inputs 12px; no other radii; no shadows/gradients.
- [ ] `.reveal` / `.txn` / `.btn-press` present; reduced-motion respected.
- [ ] Mine/Yours/Ours is gender-neutral and hue-coded per household member.
- [ ] Shared/real-time state scoped to household id, with presence shown.
- [ ] Card's Notes updated and Status moved correctly on the board.
