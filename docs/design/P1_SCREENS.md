# P1 Design Spec - Tokens, Components, Screens

Owner: product-designer. Consumer: frontend-engineer (T5a tokens/components, T5b screens). Binding: D016 honesty rules in `docs/phases/P1_DESIGN_SYSTEM.md`. Local-only: no sign-in, no "Join with a code", no invites, no email collection, no fake logos/testimonials/metrics. All sample text is fictional and labelled so.

Design intent: bright canvas, confident Plus Jakarta Sans headlines, one violet action colour, coral/mint/sun as small purposeful accents (never sole signal), generous whitespace, one recurring motif (interlocking rings + connected dots, from the P0 `HeroArt`) reinterpreted per category. Evolve P0, do not restart: keep `LogoMark`, `HeroArt`, the `ff-enter` stagger.

Evidence status: P0 screenshot at 1440 viewed. Nothing in this spec has been rendered yet; contrast ratios marked `~` are hand-estimated and MUST be added to `tokens.test.ts` (rule: no pair ships untested).

---

## 1. Tokens (additions to `packages/ui/src/tokens`; keep every existing token and value)

### 1.1 Colour
No new hues. Reuse existing tokens. Only additions:

| Token | Value | Use | Pair / ratio |
| --- | --- | --- | --- |
| `coral-800` | `#962A23` | danger button hover/pressed fill | white on it ~8.4:1 (text) |
| `shadow-ink` | `rgba(32,41,73,a)` | shadow colour base | n/a |

Approved pairs (all must be in tests; existing verified ones marked V):

| Foreground on background | Ratio | Rule |
| --- | --- | --- |
| ink on canvas / surface | ~13.5 / ~14.5 | any text |
| muted on canvas / surface (V 5.67 canvas) | >=5.6 | secondary text |
| muted on violet50 / mint50 / sun50 | ~5.0 | allowed, tinted panels only |
| white on violet700 (V 5.90), on violet800 | 5.90 / ~7.6 | primary button |
| violet700 on surface (V 5.90), on violet50 | 5.90 / ~5.0 | links, selected chip text |
| mint700 on mint50 / surface | ~5.0 / ~5.4 | success text |
| coral700 on coral50 / surface | ~5.4 / ~6.0 | error text |
| white on coral700 | ~6.0 | danger button |
| ink on sun50 / sun400 / mint500 / coral500 | >=5.5 | warning/accent chips (ink text only) |
| borderStrong `#8A93A6` on **surface** | ~3.1 (>=3 UI) | input/chip borders |

Hard rules: `borderStrong` on `canvas` is ~2.96 (fails 3:1) so form controls and chips MUST sit on `surface` (white) or have a white fill. Never use violet600, coral500, mint500, sun400 for text on light. Selected/status/error never signalled by colour alone: always icon + text (see components).

Semantic aliases to add: `focusRing` = violet800, `focusRingOffset` = surface, `surfaceNavActive` = violet50, `fgOnDanger` = white, `brandPrimaryPressed` = violet800 + inset shadow.

### 1.2 Typography
Families: heading `Plus Jakarta Sans` (800/700), body `Inter` (400/500/600). Fallback stack `system-ui, -apple-system, "Segoe UI", sans-serif`; `font-display: swap`, never block render. Numbers in meters/times: `font-variant-numeric: tabular-nums`.

| Style | Desktop (>=1024) size/line | Mobile (<768) size/line | Weight | Family | Tracking |
| --- | --- | --- | --- | --- | --- |
| display | 64/68 (4rem) | 40/44 (2.5rem) | 800 | heading | -0.03em |
| h1 | 40/46 | 30/36 | 800 | heading | -0.02em |
| h2 | 30/38 | 24/32 | 700 | heading | -0.015em |
| h3 | 22/30 | 20/28 | 700 | heading | -0.01em |
| h4 | 18/26 | 18/26 | 700 | heading | 0 |
| body-lg (lead) | 20/32 | 18/28 | 400 | body | 0 |
| body | 16/26 | 16/26 | 400 (500 for labels: 600) | body | 0 |
| small | 14/22 | 14/22 | 400/500 | body | 0 |
| caption | 12/16 | 12/16 | 600, uppercase optional +0.04em | body | |

Tablet (768-1023) uses desktop sizes except display 52/56 and h1 36/42. Text must reflow at 200% zoom and 320px; no fixed-height text boxes. Min body 16px. Line length cap 68ch.

### 1.3 Spacing, radii, elevation, z-index, breakpoints

| Token | Values |
| --- | --- |
| space (8px base, 4px half-step) | `0.5`=4, `1`=8, `1.5`=12, `2`=16, `3`=24, `4`=32, `5`=40, `6`=48, `8`=64, `10`=80, `12`=96 |
| page gutter | 16 mobile, 24 tablet, 32 desktop; content max 1152 (`max-w-6xl`) |
| section rhythm | 64 mobile, 96 desktop between landing sections; 24-32 between app blocks |
| radius | `sm` 8 (badges inner, skeleton lines), `button`/`field` 12, `card` 20, `dialog` 20, `pill` 9999 |
| tap target | min 44x44 on all breakpoints (visually smaller icons get padding) |

| Elevation | Value | Use |
| --- | --- | --- |
| `shadow-sm` | `0 1px 2px rgba(32,41,73,.06), 0 0 0 1px #E5E9F2` | resting cards |
| `shadow-md` | `0 8px 20px -6px rgba(32,41,73,.14)` | card hover, popovers |
| `shadow-lg` | `0 20px 44px -14px rgba(32,41,73,.22)` | dialogs, hero preview |

| z-index | Value |
| --- | --- |
| base | 0 |
| sticky (page header, step header) | 10 |
| nav (sidebar, rail, bottom bar) | 20 |
| popover/select | 30 |
| overlay scrim | 40 |
| dialog | 50 |
| toast/live status | 60 |
| skip link | 100 |

Breakpoints: `sm` 480 (only for 2-col card grids), `md` 768 (tablet), `lg` 1024 (desktop). Design at 320, 768, 1440; nothing may scroll horizontally at 320.

### 1.4 Focus ring (global, never removed)
`outline: 3px solid var(--ff-violet-800); outline-offset: 2px;` plus white 2px inner gap via `box-shadow: 0 0 0 2px var(--ff-surface)` on filled elements. Ring vs surface/canvas ~7.5:1. Use `:focus-visible` only; inputs also show ring on `:focus`. Windows forced-colors: `outline-color: Highlight`; borders stay `1px solid ButtonText`.

### 1.5 Motion tokens

| Token | Duration | Easing |
| --- | --- | --- |
| `duration-press` | 120ms (existing) | `ease-out` `cubic-bezier(.22,1,.36,1)` (existing) |
| `duration-fast` | 160ms | ease-out |
| `duration-enter` | 200ms (existing) | ease-out |
| `duration-reveal` | 360ms | ease-out |
| `duration-meter` | 400ms | `ease-in-out` `cubic-bezier(.4,0,.2,1)` |
| `stagger-step` | 60ms (max 8 items, then no delay) | |

Reduced motion (`prefers-reduced-motion: reduce`): all durations -> 0ms for transforms/opacity travel; state changes still apply instantly (colour/outline/text). Spinners: replaced by static icon + text "Loading...". Skeleton shimmer off (flat tint). No parallax, no auto-playing anything.

---

## 2. Components (`packages/ui`)

Common: every interactive element has visible default/hover/focus-visible/active/disabled; hover is never the only affordance; touch targets >=44px; icons from Lucide with `aria-hidden` when text exists.

| Component | Props / variants | States & visuals | ARIA / keyboard |
| --- | --- | --- | --- |
| **Button** | `variant` primary \| secondary \| ghost \| danger; `size` sm 36 (desktop only) \| md 44 \| lg 52; `loading`; `disabled`; `iconStart/End`; `fullWidth` | primary: violet700 fill, white text, hover violet800, press translateY(1px)+inset; secondary: surface, 1px borderStrong, ink text, hover violet50; ghost: no border, violet700 text, hover violet50; danger: coral700 fill/white, hover coral800. Radius 12, text 16/600 | Native `<button>`. Disabled and loading use `aria-disabled="true"` (stays focusable, click is no-op, no tooltip needed) never `disabled`. Loading: spinner icon + label becomes "Saving..." etc, width preserved, `aria-busy`. Enter/Space activate |
| **LinkButton** | same variants as Button, renders `next/link` | looks like Button; external links add icon + visually hidden "(opens in a new tab)" | Native `<a>`; Enter activates; current-page not applicable |
| **Card** | `as`, `interactive`, `tone` default \| brand \| subtle; slots header/body/footer | surface, `shadow-sm`, radius 20, padding 24 (16 mobile). Interactive hover: translateY(-3px) + `shadow-md` 160ms; focus ring on the whole card | If whole card is a link, one link per card with accessible name = title; never nest buttons in link cards (use footer buttons instead, non-linked card) |
| **Badge / StatusPill** | `tone` neutral \| brand \| success \| warning \| danger \| info; `icon` required for status tones | pill, caption text 12/600 on tone-50 bg with 700 text; neutral = surface + borderStrong border. Icon + text always: success CircleCheck, warning TriangleAlert, danger CircleAlert, info Info, "In development" = Hammer on neutral | Plain text; no role unless inside live region. Never a button |
| **TextField / NumberField / Textarea / Select** | `label` (required), `hint`, `error`, `required`, `maxLength` counter (Textarea) | surface fill, 1px borderStrong, radius 12, height 48, hover border ink, focus ring, error: 2px coral700 border + CircleAlert icon + error text coral700 below. Label above (14/600 ink), hint below label (small muted) | `<label for>`; `aria-describedby` = hintId + errorId (error only when present); `aria-invalid="true"` when error; error text `role` none (announced via focus on first invalid field after failed Next; errors also listed in an error summary `role="alert"` at step top, once). NumberField: `inputmode="numeric"`, stepper +/- buttons optional, ArrowUp/Down step 1, no scroll-wheel change. Select: native `<select>` styled (accessible, mobile-friendly); no custom listbox in P1 |
| **SearchField** | `label` visually hidden "Search activities" but a visible placeholder is not the label; clear button | magnifier icon left, clear (X) button right when non-empty, `type="search"` | Esc clears; clear button 44px with name "Clear search"; result count in `aria-live="polite"` region (debounce 250ms): "6 activities" / "No activities match" |
| **FilterChips** | group `role="group"` + `aria-label`; chip: `pressed`, `count?` | surface, 1px borderStrong, radius pill, height 44, text 14/600. Pressed: violet50 fill, 2px violet700 border, leading Check icon (so not colour-only). Hover violet50. Toggle 160ms | Native `<button aria-pressed>`; Space/Enter toggle; Tab between chips (no roving needed) |
| **Stepper** | `steps[{id,label}]`, `current`, `completed`, errored step flag | desktop: horizontal numbered track; mobile: compact "Step 2 of 4 - Participants" + 4-segment bar. Completed: Check icon; current: violet700 filled number, label ink 600; upcoming: borderStrong outline. Error step: CircleAlert + "needs attention" text | `<nav aria-label="Event steps"><ol>`; current item `aria-current="step"`; completed steps are buttons allowing Back navigation; upcoming steps not links. On step change focus moves to the step `h2` (tabindex -1) and `aria-live` announces "Step 2 of 4: Participants" |
| **Skeleton** | `variant` line \| block \| card; `count` | `border`-tone tint, radius 8, shimmer 1.4s gradient sweep (only motion allowed to loop, off under reduced motion), max 3s then the screen must resolve to content or error | Container `aria-busy="true"` + visually hidden "Loading ..." text in a `role="status"`; skeletons `aria-hidden` |
| **EmptyState** | `illustration`, `title` (h2/h3), `body`, `primaryAction`, `secondaryAction?` | centred card, 160px motif, tonal panel (violet50/sun50 blob) | Heading level matches context; actions are real buttons/links |
| **ErrorState** | `title`, `body`, `onRetry`, `detail?` | coral50 panel, CircleAlert, Retry primary button; busy retry shows loading button | Container `role="alert"` only when appearing after an action; on initial load use `role="status"`. Retry keeps focus on the Retry button; after success focus moves to first heading of content |
| **DeniedState** | `title`, `body`, `action` | like ErrorState with Lock icon, mint/ink-neutral not red; built + component-tested; not routed in P1 | `role="status"`; no information leakage in copy |
| **Notice / Banner** | `tone` info \| warning; `title?`; `dismissible?` (not for plan notices) | tone-50 fill, 1px tone border (borderStrong-equivalent: info violet700, warning ink), left icon, ink/muted text. Info = Info icon, warning = TriangleAlert + prefix word "Heads up:" visually shown | Static: `role="note"` (no live). Dynamic additions (e.g. over time) are inside a polite live region wrapper |
| **RuntimeMeter** | `eventMinutes`, `activityMinutes`, `bufferMinutes`, `segments[{slug,label,minutes}]` | track height 16, radius pill, segments in violet700/violet600 alternating with 2px white gaps (+ ink minute labels under track on >=md); buffer remainder = border-tone hatch pattern; over-time overflow = coral700 hatch + AlertTriangle and text. Fill animates 400ms | `role="meter"` NOT used for multi-segment; use `role="img"` with `aria-label` text equivalent AND visible text: "42 of 60 minutes planned, 18 minutes of buffer" or "70 of 60 minutes planned, 10 minutes over". Changes announced via the same string in a polite region (debounced 500ms) |
| **ReorderList** | `items`, `onMove`, `renderItem` | rows: card tone, drag handle (optional, pointer only), always-visible Move up / Move down icon buttons (44px), Remove button. Moving row highlights with violet50 for 600ms | Buttons named "Move Trivia Rush up (position 3 of 4)", first Up and last Down `aria-disabled`. After move, focus stays on the same button of the moved row (re-render keeps key). Announce in polite region: "Trivia Rush moved to position 2 of 4." Drag is optional enhancement, never required; `<ol>` semantics |
| **Dialog** (needed for delete confirm) | `title`, `description`, actions | scrim ink@50%, radius 20, `shadow-lg`, enter 200ms scale .98->1 + fade | `role="dialog"` `aria-modal`, labelled/described, focus trap, Esc closes, initial focus on the safe action (Cancel), focus returns to trigger (or next list item if item deleted) |
| **LiveStatus / Toast** | `message`, `tone` | bottom-centre pill (mobile: above tab bar, +72px), 5s then fades (200ms) - message ALSO remains as inline text near the action, so toast is optional reinforcement | One persistent `<div role="status" aria-live="polite">` mounted at app root; messages inserted into it; errors use `role="alert"` separately; toasts never take focus and have no action buttons |
| **Skip link** | visually hidden until focus | top-left, button style, z-100 | First tabbable element; "Skip to main content" -> `#main` (tabIndex -1) |

---

## 3. Screens

Global: page `<title>` pattern `Page - FunFriday`; one `h1` per page; landmarks banner/nav/main/contentinfo; fictional-data note only where sample data appears.

### 3.1 Landing `/`
Public header: LogoMark + wordmark (left); right: "Activities" text link (/app/library) and "Plan a FunFriday" Button md (/app/events/new). No sign-in. Mobile: wordmark + single compact "Plan a FunFriday" button (no menu).

| Block | Desktop >=1024 | Tablet 768-1023 | Mobile <768 |
| --- | --- | --- | --- |
| Hero | 2 col 1.1fr/0.9fr, 96px top; eyebrow pill "Preview build - nothing is sent or shared"; display "Good teams work together. Great teams connect."; lead "Short, inclusive games that help distributed and in-person teams relax, laugh and get to know each other."; CTAs primary "Plan a FunFriday" + secondary "Explore activities"; HeroArt right | 2 col narrower, display 52 | 1 col, art below copy (max 320 wide), CTAs stacked full width, display 40 |
| Product preview | Static, honest composite of the real builder UI (agenda timeline with 3 activities, RuntimeMeter) in a browser-like frame, tilted 0deg, `shadow-lg`; caption "Illustration of the planner. Sample plan is fictional." `role="img"` with alt describing it | same, 100% width | same, cropped at top-left, height max 360, no horizontal scroll |
| Benefits (h2 "Made for real teams, not forced fun") | 3 cards: "Short and playful" (10-30 minute sessions), "Everyone can join" (every personal question has a pass option), "Plan in minutes" (pick activities, see your runtime) | 3 cols narrow or 1+2 | 1 col |
| 3-step walkthrough (h2 "From idea to Friday in three steps") | `ol` horizontal numbered with connecting dotted line: 1 "Set the basics" (name, time, time zone), 2 "Choose activities" (pick from the catalog, see how long they run), 3 "Review the agenda" (see local times at a glance) | same | vertical with dotted line left |
| Activities teaser | row of 3 category-motif tiles + link "Explore activities" | | horizontal scroll NOT allowed; 1 col of 3 compact tiles |
| Trust area (h2 "Designed to be comfortable for everyone") | 4 items w/ icons: "Accessible by design" (keyboard use, reduced motion, screen reader text, WCAG 2.2 AA target); "Privacy first" (nothing you type here leaves this device in this preview); "No camera required" ; "No surveillance" (we do not rank people or track individual performance or mood). Claims are product intent, phrased as "built for"; no metrics/logos/quotes | 2x2 | 1 col |
| Footer | 3 groups: brand blurb; "Product" (Activities, Plan a FunFriday); "Help" (**System status** -> /status). Line: "Preview build. All sample content is fictional." | | stacked |

States: default; hover (button lift 1px + color step 160ms); focus; reduced motion (no entrance, no HeroArt drift); no-JS: all content renders (server components); status link works.
Decorative motion: HeroArt rings rotate 0 (static). Only entrance stagger.

### 3.2 App shell `/app/*`

| Breakpoint | Nav | Spec |
| --- | --- | --- |
| >=1024 | Left sidebar 264px, surface, 1px border right | Logo top; items 48px tall: Dashboard (LayoutDashboard), Activities (Library), Plan event (CalendarPlus); persistent primary Button "Plan a FunFriday" under logo (fullWidth); bottom: Notice card "Preview workspace" |
| 768-1023 | Icon+label rail 96px | icon 24 above label 12/600 (never icon-only); quick-create is a primary 56px round-rect icon button with label "Plan" |
| <768 | Bottom tab bar 64px + safe-area inset, surface, top border, z-20 | 3 tabs Dashboard / Activities / Plan, equal width, 44+px, icon over label 12/600; no drawer; content gets `padding-bottom: 88px`. No separate quick-create (Plan tab is it) |

Current page: `aria-current="page"` + violet50 pill background + violet700 text + 3px left bar (sidebar) / 3px top bar (tabs) - shape + weight 700, not colour only. Header strip in main: page title area plus breadcrumb for `/app/events/new` ("Dashboard / Plan event"). Notice (info, persistent, not dismissible): title "Preview workspace", body "Accounts arrive in a later phase. Anything you save stays on this device." On <768 shown as a one-line banner under the page title on Dashboard only; on other pages reachable via the dashboard (avoid clutter).
Shell states: loading route (3.8), reconnecting not applicable (no realtime in P1). Keyboard: skip link -> main; nav is a `<nav aria-label="Primary">` with a list of links; Tab order sidebar then main.
Transition between routes: main content fade/rise 8px, 200ms; none under reduced motion.

### 3.3 Dashboard `/app`
h1 "Your Fridays". Subtext "Plans you save appear here. They live on this device only."

| Part | Spec |
| --- | --- |
| Next-draft highlight (when >=1 draft) | Card tone brand, full width, 2 col desktop: left caption "Up next", h2 title, local date/time + zone, "4 activities - 38 min planned of 45"; right motif + Continue editing primary. Chosen: draft with nearest future start; if none, most recently edited. Mobile: stacked |
| Drafts list (`h2` "Drafts on this device (N)") | Grid 2 col desktop (>=1024), 1 col below. Card: title h3; row: Calendar icon + "Fri 24 Oct 2026, 15:00 (Europe/London)"; Users icon "20 expected"; Clock icon "38 min of 45"; Badge neutral "Draft - this device". Actions: `Continue editing` (secondary, LinkButton to `/app/events/new?draft=id`), `Delete` (ghost danger-text, Trash icon, name "Delete draft Team Friday") |
| Delete confirm Dialog | Title "Delete this draft?"; body "Team Friday will be removed from this device. This can't be undone."; Cancel (default focus) / "Delete draft" danger. After delete: toast "Draft deleted", focus to next card's title or the h2 if none |
| Empty (no drafts) | EmptyState with warm motif (rings + sun squiggle): title "No plans yet. Let's make Friday worth looking forward to."; body "Plan a short session in a few minutes. You'll choose a time, who it's for and which activities to include."; primary "Plan a FunFriday"; secondary "Explore activities" |
| Loading | 2 skeleton cards (storage read is fast, show skeleton only if >150ms to avoid flash) |
| Error (storage unavailable/corrupt) | ErrorState: "We couldn't read your drafts" / "Your browser may be blocking storage, for example in private mode. You can still plan an event, but saving may not work." Retry + "Plan a FunFriday". Corrupt single draft: card shows "This draft can't be opened" + Delete only |
Mobile: sections in the order Notice, highlight, list. Copy for sample: none (no fake drafts ever shown).

### 3.4 Library `/app/library`
h1 "Activities". Lead: "Short games and moments for your team. Browse what's planned and add them to an event." Data: `GET /api/v1/activities`, real only.

Toolbar (surface panel, sticky z-10 under shell header on >=md, static on mobile): SearchField (full width), chips group "Category", two Selects "Group size" and "Duration".

| Filter | Options |
| --- | --- |
| Category chips (labels) | `icebreaker` "Icebreakers", `check_in` "Check-ins", `quiz` "Quizzes", `guessing` "Guessing games", `creative` "Creative"; multi-select OR; none pressed = all |
| Group size select | "Any size", "2-5 people", "6-10 people", "11-20 people", "21-50 people", "51+ people" - match when ranges overlap [minPlayers,maxPlayers] |
| Duration select | "Any length", "Up to 5 min", "5-10 min", "10-15 min", "15+ min" - match on estimatedMinutes overlap |
Filter summary row: "Showing 4 of 6 activities" (polite live) + "Clear filters" ghost button (only when active). Filters sync to URL query (`q`, `cat`, `size`, `dur`) so back/refresh keeps them.

Mosaic: 3 col >=1024, 2 col >=480 (tablet and large phone), 1 col <480. Equal-height cards (grid, `min-height` 280). Card layout: top 120px motif panel (category-coloured, 3.4a), badges row, h3 name, summary (3-line clamp is NOT used; full text, <=280 chars), meta row with icons and text: Users "{min}-{max} players", Clock "{min}-{max} min", category text label, availability Badge: `planned` -> "In development" (Hammer), `enabled` -> "Ready to play" (CircleCheck, success), `disabled` never shown. No per-card action in P1. Cards are non-interactive articles (no hover lift) to avoid dead affordance.

3.4a Category motifs (original SVG, 5, built from rings, dots, squiggles, 2 accent colours + violet; decorative `aria-hidden`; ink-tint lines on tone-50 panel):

| Category | Panel bg | Motif |
| --- | --- | --- |
| Icebreakers | violet50 | two overlapping rings, dot on each |
| Check-ins | mint50 | row of 5 dots of varied size under a smile arc |
| Quizzes | sun50 | stacked rounded squares with one lifted, question-mark negative space |
| Guessing | coral50 | ring with dotted trail and one hidden (outlined) dot |
| Creative | violet50 + coral/sun accents | squiggle line crossing a triangle and square |

States: loading = 6 skeleton cards + `role=status` "Loading activities"; no-results: EmptyState "No activities match" / "Try a different search or clear a filter." + "Clear filters"; API error: ErrorState "We couldn't load the activities" / "The activity list didn't come through. Your filters are kept. Try again." Retry; empty catalog (0 returned): "No activities yet" / "Check back soon." Capacity notice (info Notice above grid when group-size filter is active and some results are hidden): "Some activities are hidden because they don't fit a group of this size." plus per-card line when filtered range exceeds the activity range: "Works best for 2-12 people". Offline: ErrorState with "You seem to be offline" variant title.
Reduced motion: card entrance stagger off.

### 3.5 Event builder `/app/events/new` (`?draft=id` continues; unknown id -> ErrorState "We couldn't find that draft" + "Start a new plan")
Layout: >=1024: 2 col: form (max 640) left, sticky "Your plan" summary panel (title, when, group, RuntimeMeter, notices) right 360px. <1024: single col; summary collapses into a `<details>` "Plan summary" above the nav buttons (closed by default). Persistent top: Stepper; bottom action bar (sticky on mobile above tab bar, 72px, z-10): Back (secondary), Next (primary), and "Save draft on this device" (secondary with HardDrive icon; on mobile sits above, full width).

Header Notice (info, all steps, non-dismissible): "This is a draft planner. Nothing is sent, shared or scheduled. Saving keeps your draft in this browser only."

| Step | Fields and rules (contract limits) |
| --- | --- |
| 1 Basics | Title (3-80; hint "Something your team will recognise, like Friday Reset"; counter); Date (`type=date`) and Time (`type=time`) side by side desktop, stacked mobile -> `startsAtLocal`; Time zone Select (IANA list, default `Intl.DateTimeFormat().resolvedOptions().timeZone`, hint "We picked this from your browser. Change it if you're planning for another place."); Duration NumberField minutes (15-240, step 5, hint "Total length of the event, including breaks."); optional Meeting link (https only, hint "Optional. Paste your meeting link; we don't open or send it.") |
| 2 Participants | Expected group size NumberField (2-200; hint "A rough headcount is fine."); Notice info: "Invitations arrive in a later phase. For now, tell us how many people you expect so we can check your activities fit." No names/emails. No live helper text; capacity notices appear in step 3 and Review only |
| 3 Activities | Two panes desktop (picker left, playlist right); mobile: playlist first when non-empty, then picker. Picker: catalog list rows (name, category badge, "{min}-{max} players", suggested minutes, availability badge) with `Add` button (name "Add Trivia Rush"); added rows show "Added" + Check and button becomes "Remove" (toggle button `aria-pressed`). Default minutes = rounded midpoint of estimatedMinutes. Playlist = ReorderList; each row: position number, name, NumberField minutes (2-60, label "Minutes for Trivia Rush"), Up/Down/Remove. Max 8 (at limit: Add buttons `aria-disabled` with Notice "You've added 8 activities, the most one plan holds."). RuntimeMeter beneath, always visible. Capacity notices per row (see 3.5a) |
| 4 Review | h2 "Review your plan". Summary header: title, "Fri 24 Oct 2026, 15:00-15:45", zone name, group size. Agenda timeline (vertical `ol`, dotted spine, node = category-colour dot with number): start-end clock times per activity incl. transition time (2 min each, labelled "Transition"), computed from `zonedWallTimeToUtc`. Time block: "Your time zone: 15:00 Europe/London" and when viewer zone differs "In your browser's zone: 10:00 America/New_York". DST note when planned date is within 24h of a transition or ambiguous (fall-back repeated hour): Notice warning "Clocks change in this time zone around that time. Check the start time is the one you mean." Plan notices list (3.5a). Final actions: Back, "Save draft on this device" (primary here). NO "Create event/Send invites". Under it muted: "Next steps like invitations arrive in a later phase." |

3.5a Notice copy (from `reviewEventPlan`)

| kind | tone | Copy |
| --- | --- | --- |
| over_time | warning | "Heads up: your activities run {n} minutes over the event length. Shorten an activity or extend the event." |
| tight_transitions | info | "Good to know: leave about {x} minutes for introductions and switching between activities. You have {buffer}." |
| group_too_small | warning | "Heads up: {name} works best with at least {min} people." |
| group_too_large | warning | "Heads up: {name} is built for up to {max} people. Consider splitting into teams later." |
| not_playable_yet | info | "Good to know: {name} is still in development, so it can't run yet. You can keep it in your plan." |
| unknown_activity | warning | "Heads up: an activity in this draft is no longer in the catalog. Remove it to continue." |
Notices never block Next except `unknown_activity`; validation errors (schema) do.

Validation: per-step on Next and on blur; failed Next shows error summary (`role="alert"`, h3 "Please fix 2 things", links to fields), focus moves to summary; per-field errors use contract messages verbatim. Back never validates. Completed steps clickable. Errored steps flagged in Stepper.

Save states (one status area beside the Save button, `aria-live=polite`, text + icon always):

| State | Visual | Text |
| --- | --- | --- |
| Clean-new | muted | "Not saved yet" |
| Dirty | sun50 pill + Dot icon | "Unsaved changes" |
| Saving | spinner (static icon in reduced motion), button loading | "Saving to this device..." |
| Saved | mint50 pill + Check, 600ms check-draw (instant if reduced) | "Draft saved on this device at 14:32" (toast mirrors: "Draft saved") |
| Invalid-save | coral50 + CircleAlert | "Can't save yet. Fix the highlighted fields." (save allowed when title + basics are valid; see open question 1) |
| Storage error | ErrorState inline | "We couldn't save this draft. Your browser may be blocking storage. Your changes are still on this page." Retry |
Leaving with unsaved changes: `beforeunload` native prompt while dirty; in-app nav link clicks open Dialog "Leave without saving?" / "You have changes that aren't saved on this device." buttons "Keep editing" (default), "Save draft" , "Leave without saving" (ghost danger). Dirty state also shown in the page title prefix "* ".
Stepper change animation: panel crossfade 200ms (+8px translate in step direction); under reduced motion instant, focus still moves to step heading.
Loading (draft hydrate): Skeleton form lines 3, `role=status`. Reconnecting/denied: n/a in P1 (no network at all in builder except catalog fetch: if catalog fails on step 3, ErrorState "We couldn't load the activities" + Retry; steps 1-2 remain usable).

### 3.6 `/status`
Reuse P0 StatusPanel inside public-style layout (landing header/footer), h1 "System status". States already in P0 (operational, degraded, error with retry, loading); add token styling only. Link back "Back to home".

### 3.7 Not found / route error / route loading

| Screen | Spec |
| --- | --- |
| 404 (`not-found`) | EmptyState with lost-dot motif (ring with a dot outside); h1 "We can't find that page"; body "The link may be old or mistyped."; primary "Go to dashboard" (/app), secondary "Back to home" (/) |
| Error boundary (`error.tsx`) | ErrorState h1 "Something went wrong"; body "That didn't work on our side. Your saved drafts are safe on this device."; primary "Try again" (reset), secondary "Go to dashboard"; no stack traces; digest id not shown |
| Loading (`loading.tsx`) | Shell stays; main shows h1-sized skeleton + 3 card skeletons; `role=status` "Loading page" |

---

## 4. Motion spec (summary)

| Interaction | Property | Duration / easing | Reduced motion |
| --- | --- | --- | --- |
| Page/section entrance | opacity 0->1, translateY 12->0 | 200ms ease-out, 60ms stagger (<=8) | none, instant |
| Route change in app main | opacity + translateY 8 | 200ms ease-out | instant |
| Card hover lift | translateY -3px, shadow sm->md | 160ms ease-out (return 160ms) | no transform; shadow/border change instant |
| Button press | translateY 1px, shadow inset | 120ms ease-out | colour change only |
| Chip toggle | bg/border colour, check icon scales .6->1 | 160ms ease-out | instant |
| Stepper step change | panel crossfade + 8px slide; progress segment fill | 200ms; segment 360ms ease-out | instant |
| RuntimeMeter fill | width of segments | 400ms ease-in-out; over-time hatch appears with no flash | instant |
| Reorder move | row swap fade/translate 160ms, highlight 600ms | ease-out | instant, highlight static 600ms border |
| Dialog | scrim fade + panel scale .98->1 | 200ms ease-out; exit 120ms | fade removed |
| Toast | slide 12px + fade; auto-dismiss 5s; exit 200ms | ease-out | fade-only becomes instant |
| Save check | check path draw | 360ms | instant |
| Skeleton | shimmer sweep | 1.4s loop (the only loop, besides spinner) | flat tint, spinner static |
No parallax, auto-play video, or looping decorative animation. Never animate layout properties (width excluded for meter, which uses transform scaleX where possible).

## 5. Copy deck (additional, consistent tone: warm, plain, optional-first)

| Context | String |
| --- | --- |
| Preview notice | "Preview workspace - accounts arrive in a later phase" |
| Local save explanation | "Drafts are saved in this browser only. Clearing your browser data will remove them." |
| Delete toast | "Draft deleted" |
| Save toast | "Draft saved" |
| Step announcements | "Step {n} of 4: {label}" |
| Meter text | "{planned} of {total} minutes planned, {buffer} minutes of buffer" / "{planned} of {total} minutes planned, {over} minutes over" |
| Loading | "Loading activities..." / "Loading your drafts..." |
| Offline | "You seem to be offline. Check your connection and try again." |
| Skip link | "Skip to main content" |
| Participants disclaimer | "We never ask for names or email addresses in this preview." |
| Avoid | "employees must", "mandatory fun", "leaderboard", "perform", countdown guilt, exclamation overload, "Oops!" |

## 6. Acceptance checklist (reviewer, at 320 / 768 / 1440)

Global (every screen, every breakpoint)
- [ ] No horizontal scroll at 320; text reflows at 200% zoom; tap targets >= 44px
- [ ] Focus ring visible on every control, never clipped; skip link first Tab stop
- [ ] One h1; headings in order; landmarks present; page title set
- [ ] Reduced motion: no transforms, no looping shimmer, spinner static; verified via emulation
- [ ] No state conveyed by colour alone (icon/text/shape present)
- [ ] No dead buttons; no "sign in", "Join with a code", "Create event", "Send invite", emails, logos, testimonials, metrics
- [ ] Only existing routes linked; 404 reachable

| Screen | Checks |
| --- | --- |
| Landing | 320: stacked hero, full-width CTAs; 768: 2-col hero; 1440: hero + preview within first 2 screens; preview captioned fictional; trust claims phrased as intent; footer has System status |
| Shell | >=1024 sidebar 264; 768-1023 rail with visible labels; <768 bottom tabs, no drawer; current page indicated by shape+weight; quick-create present (sidebar/rail), preview notice visible |
| Dashboard | Empty copy exact; with drafts: title, local date/time + zone, count, runtime, Continue, Delete -> confirm; loading/error states; no fake drafts |
| Library | Real data of six; filters + URL sync; chips aria-pressed with check; no-results, loading, error+retry, capacity notice; "In development" badges; five distinct motifs; equal card heights |
| Builder | 4 steps with aria-current; field errors linked (aria-describedby/invalid); tz defaulted, DST gap error and note; meter with text; keyboard reorder announced; saved/dirty/invalid/saving/error states; unsaved guidance; copy states nothing is sent |
| Review | Agenda times correct incl. transitions; local + viewer zone shown when different; notices match table |
| Status/404/error/loading | Exact copy, actions work, no stack trace, skeleton resolves |
| Keyboard | Full builder completed with keyboard only; dialogs trap and restore focus |
| Contrast | Every pair in 1.1 present in tokens test; axe zero serious/critical |

## 7. Open questions for the lead
1. Partial draft saving: spec allows saving when title and basics are valid (not requiring all steps). Confirm, or require full `eventDraftSchema` validity.
2. `?add=slug` from Library cards is deliberately excluded; confirm that no per-card action in P1 is acceptable (alternative: "Add to plan" that opens builder step 3).
3. Time-zone list size: use `Intl.supportedValuesOf('timeZone')` (~420 entries) in a native select with browser zone pinned first; confirm.
