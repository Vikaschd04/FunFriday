# Product Design System and Motion Specification

## Creative brief

**Feel:** friendly, premium, memorable, warm, confident. Behave like a high-end collaboration platform with fun event-game moments. The underlying information architecture must stay corporate-clear; color and motion add emotion and guidance.

**Design quality bar:** no generic Bootstrap-like dashboard, no inconsistent card sizes, no meaningless icons, no childish gradients, no stock-video autoplay; deliberately designed hero, empty states, navigation, event steps, game shells and results. Iterate with screenshots and user-testing feedback.

## Brand palette (candidate tokens; verify WCAG contrast in actual use)

| Token | Hex | Suggested purpose |
| --- | --- | --- |
| `ink` | `#202949` | headings, readable dark surfaces |
| `violet-600` | `#7765EF` | primary brand/button accent (check small-text contrast) |
| `coral-500` | `#FF7067` | playful highlights / alerts (not sole signal) |
| `mint-500` | `#35C8B2` | success and collaborative cues |
| `sun-400` | `#FFD166` | celebration and warmth |
| `canvas` | `#F8FAFC` | app background |
| `surface` | `#FFFFFF` | cards and navigation |
| `border` | `#E5E9F2` | dividers and outlines |
| `muted` | `#64748B` | secondary text where contrast passes |

Use semantic aliases: `bg.canvas`, `surface.default`, `fg.primary`, `fg.muted`, `brand.primary`, `state.success`, etc. Dark hover/pressed values need real contrast audits, not blind lightening. A violet fill with white text may not meet normal-text AA, so adjust tokens based on calculated contrast.

Typography: Plus Jakarta Sans or Manrope for headings; Inter for body. Favor variable fonts or self-hosted licensed files; do not block page if font fails. Consistent size/line-height ramps; readable mobile font sizes. Use 8px base spacing; corner radii: buttons 12px, cards 18-24px, dialogs 20px.

## Layouts

**Landing:** expressive hero with illustrated abstract connected shapes or micro-game previews, single clear CTA, product preview, benefits, three-step walkthrough, trust area, accessibility and support details. Avoid unsupported customer logos/testimonials.

**App shell:** left sidebar at large widths, collapsible rail on tablet, bottom or drawer nav on mobile; persistent quick-create CTA, avatars, top-level breadcrumbs, prominent next event, easy library discovery.

**Session builder:** guided stepper (Basics -> Participants -> Activities -> Review), inline form validation, timezone clarity, estimated runtime meter, multi-select/draggable playlist, preview panel with who-can-play constraints.

**Library:** card mosaic with purposeful illustrations, category filters, search, accessibility tags, duration and player count; delightful but not overwhelming. Each game page has play preview, rules, configuration and level-of-disclosure cues.

**Live game shell:** fixed game status bar, hero action center, right participant roster on desktop, collapsible participant dock on phone, accessible timer, discreet reaction bursts, feedback and next-step control. On mobile optimize tap targets >44px.

**Results:** personalized feel without pressure, team celebration, moments rather than only individual ranking, clear CTA to next game and session wrap.

## Micro-interaction system

- Navigation: gentle enter/exit 180-240ms using opacity + transform.
- Cards: hover lift 2-4px and subtle shadow, never disorienting 3D spins.
- CTA: tactile pressed state 80-150ms, disabled/loading feedback.
- Poll vote: immediate acknowledgement with optimistic affordance; reconcile with server ack.
- Round timer: use server deadline, subtle visual pulse only in final seconds; always numeric text and polite audio option.
- Reveal: stagger bars 80ms where appropriate, reveal result only after server announcement.
- Score change: count-up 300-500ms; respect reduced motion and don't rely on color alone.
- Celebration: brief confetti/spark burst 800-1500ms after major end-state, user-configurable reduced effects.
- Skeletons: minimally animated placeholders; avoid flashing and gratuitous infinite loops.
- Correct/incorrect: readable text and icons, not red/green color-only feedback.

Use Motion or CSS transitions selectively; avoid heavy animations on low-power devices, especially when 20+ animated avatars are present. Limit simultaneous compositing; implement virtualization for larger rosters.

## Design tokens and assets

Generate token source in `packages/ui` as CSS variables and TS constants, with light and optional dark definitions. Use a coherent icon library such as Lucide. Create an original, legally usable illustration style, not random web image assets. Use vector accents, recurring character-free abstract motifs (interlocking loops, confetti shapes, connected dots), and friendly avatar palettes. Prefer original icons per game.

## Interactive polish acceptance

- All screens have keyboard focus and hover/focus/disabled/success states.
- Text, buttons, charts and time indicators remain legible at 320px wide and zoom 200%.
- Drag-only reordering has keyboard alternative.
- Modals trap focus and restore it on close; error messages associate with fields.
- Motion obeys `prefers-reduced-motion`; sound effects default optional/mutable.
- All animations meaningfully indicate cause, response, or reward.
- Both low-end mobile and wide desktop versions pass visual QA with screenshots.
- Every major view tested with 1, 5, 20 and 100 participants (where supported).

## Product copy examples

- Hero: "Good teams work together. Great teams connect."
- CTA: "Plan a FunFriday" / "Join with a Code"
- Lobby: "Your crew is gathering" / "You're ready!"
- Check-in: "Pick the vibe you're bringing today"
- Empty events: "No plans yet. Let's make Friday worth looking forward to."
- Post-session: "Less awkward. More awesome."

Avoid overly familiar phrases, coercive copy, infantilizing language and competitive shaming.
