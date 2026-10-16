# P4 Live Screens - Sessions + This or That

Owner: product-designer. Consumer: frontend-engineer. Reuses P1 tokens/components (`docs/design/P1_SCREENS.md` sections 1-2: Button, Card, Badge, TextField, NumberField, Dialog, Notice, Skeleton, EmptyState, ErrorState, LiveStatus, focus ring, motion tokens, app shell). Data shapes: `packages/contracts/src/realtime/events.ts`, `games/this-or-that.ts`, `realtime/session.ts`.
Evidence: spec only. Existing app screenshot (members-admin-1440) viewed for visual continuity; nothing here has been rendered. Contrast ratios are hand-estimates and must be added to `tokens.test.ts`.

Rules that apply everywhere: 44px minimum targets; every status = icon + text; never show who chose what; buttons that cannot act are `aria-disabled` with visible reason text, never silently dead; no fake participants or placeholder games; sample copy in marketing is fictional, live data is real.

---

## 1. Tokens added (no new hues)

| Token | Value | Use | Pair / ratio |
| --- | --- | --- | --- |
| `choiceA` | fill violet50, 2px border violet700, text ink, badge "A" = violet700 fill, white text | choice A, bar A | white on violet700 5.90; ink on violet50 ~13 |
| `choiceB` | fill coral50, 2px border coral700, text ink, badge "B" = coral700 fill, white text | choice B, bar B | white on coral700 ~6.0; ink on coral50 ~12 |
| `choicePass` | fill surface, 2px dashed borderStrong, text ink | Pass, pass bar | borderStrong on surface ~3.1 |
| `barPatternB` | 45deg hatch (coral700 on coral50, 4px stripes) | bar B fill (A is solid violet700, Pass is dotted muted) so bars differ by texture and by label | n/a |
| `roomCode` type | Plus Jakarta Sans 800, 56/60 mobile, 96/100 desktop, tracking 0.12em, tabular, `font-feature-settings: "ss01"` off | lobby code | ink on surface 14.5 |
| `timerNumeral` type | Plus Jakarta Sans 800, 40/44 mobile, 56/60 desktop, tabular-nums | countdown | ink on surface 14.5 |
| `urgent` | text ink + Clock icon + 3px coral700 bar segment | last 5s emphasis (shape + weight, not colour only) | |
| Motion | `duration-count` 480ms ease-out (count-up), `stagger-bars` 80ms | reveal | |

Surface rule: live pages sit on canvas; choices, inputs and chips sit on white cards (borderStrong needs white).

---

## 2. Entry points (dashboard `/app`)

New block directly under the h1, above Drafts.

| Element | Spec |
| --- | --- |
| Section | h2 "Live sessions". Two cards side by side desktop (>=1024), stacked below |
| Card 1 "Start a live session" | Visible only if role Admin or Host. Violet50 tone card, small ring motif. Body "Open a room, share the code, play together." Optional TextField "Session title (optional)" hint "Shown to your team. Leave blank for 'Friday session'." (2-60 chars, error copy from contract: "Use at least 2 characters." / "Keep the title under 60 characters."). Primary Button "Start a live session" (loading label "Opening room..."). Success: route to `/app/live/[id]`. Participants never see this card (not disabled, absent) |
| Card 2 "Join with a code" | Everyone signed in. TextField label "Room code", hint "6 characters, like K7P2QM. Capitals and spaces don't matter.", `autocapitalize="characters"`, `autocomplete="off"`, `spellcheck=false`, `inputmode="text"`, display uppercase, `maxlength=12` (allows pasted spaces), strip spaces/dashes on change, letter-spacing 0.12em. Button "Join session" (loading "Joining..."). Enter submits |
| Join errors | Not 6 valid chars: inline "Enter the 6-character code." (alphabet excludes 0 O 1 I L; if user types them, same message plus hint "Codes never use 0, O, 1, I or L."). 404/ROOM_NOT_FOUND: "We couldn't find an open session with that code. Check it and try again." (never reveal other orgs). RATE_LIMITED: "Too many tries. Wait a moment and try again." SERVICE_UNAVAILABLE: "We couldn't join just now - try again." Error summary `role="alert"` once, focus to the field |
| Active sessions list | h3 "Happening now in {org name}". Rows (Card, 1 col mobile, 2 col desktop): title h4, "Hosted by {name or 'a teammate'}", status Badge "In lobby" (Users icon, mint tone) or "In progress" (Radio icon, violet tone), code in small mono-ish caption "Code K7P2QM", "Started 12 min ago" (relative, plus `title` full time). Action LinkButton secondary "Join" (name "Join Friday session"). Whole-row not a link |
| List states | Loading: 2 Skeleton cards. Empty: EmptyState (small, 96px motif) "No live sessions right now" body "When someone opens a room it appears here." + (Admin/Host only) primary "Start a live session" which focuses the title field. Error: ErrorState "We couldn't load live sessions" + Retry. List refreshes on focus and every 20s (silent; `aria-live` none) |

---

## 3. Lobby `/app/live/[sessionId]`

Page title "Lobby - {title} - FunFriday". h1 = session title. Join sequence: `session:join` -> skeleton "Joining the room..." (max 3s) -> lobby or error (section 9). Realtime shell wraps all live states: ConnectionBanner (section 6.6).

### 3.1 Layout

| Breakpoint | Layout |
| --- | --- |
| 320 | Single column, 16 gutter, order: code card, I'm ready, host panel (host only), roster dock collapsed at bottom (section 8). No horizontal scroll; code at 56px with 0.08em tracking fits 320 (6 chars ~ 250px) |
| 768 | Single column max 640 centred; roster as card below; host panel full width |
| 1440 | 2 columns inside 1152 max: left 7/12 code card + host panel; right 5/12 roster card (sticky top 24). Participants (non-host) see code card + roster only, centred in same grid |

### 3.2 Code card (Card tone brand, violet50)

| Part | Spec |
| --- | --- |
| Caption | "Room code" |
| Code | `roomCode` type, `aria-label` spelled "K, 7, P, 2, Q, M" via `<span aria-label>` while visible text is "K7P2QM"; selectable |
| Buttons (secondary, md, side by side; stack full width at 320) | "Copy code" (Copy icon) -> label "Code copied" with Check icon 2s, polite status "Room code copied"; "Copy link" (Link icon) -> "Link copied". Clipboard failure: select the text and show inline "Copy didn't work. Select the code and copy it yourself." |
| Helper | "Share this with your team. Only people in {org} can join." |

### 3.3 Roster (Card, h2 "In the room (N)")

| Row part | Spec |
| --- | --- |
| Avatar | 32px initial disc (ink on violet50), decorative |
| Name | `name` or "Teammate" if null; own row suffix "(you)"; host Badge "Host" (Crown icon, brand) |
| Presence | text + icon: "Connected" (Wifi icon, mint700 text) / "Away" (WifiOff icon, muted text). Away rows 100% opacity text (no fading) |
| Ready | "Ready" (CircleCheck, mint700 on mint50 pill) / "Not ready yet" (Circle, muted). Both always rendered as text |
| Order | Host first, me second, then alphabetical; stable (no reshuffle on presence change) |
| Updates | Joins/leaves: polite status "Mia joined" / "Mia left" batched at most 1 per 3s ("3 people joined"); row enter 200ms |
| Summary line | "5 connected, 3 ready" above list (live count, not announced per change) |

Empty lobby (only me): in roster, EmptyState compact: "Just you so far" body "Share the code above. You need at least 2 people to start." (no fake avatars, no ghost rows).
List > 12: scroll inside card, max-height 480px, keyboard scrollable (`tabindex=0`, labelled region).

### 3.4 "I'm ready" toggle (everyone incl. host)

Button `aria-pressed`. Off: secondary "I'm ready" (Circle). On: primary-tone mint: mint700 text on mint50, 2px mint700 border, CircleCheck, label "You're ready - tap to undo". Pending (ack-driven, `participant:ready` with clientActionId): `aria-busy`, label "Saving...", state changes only on ack/state broadcast. Rejected: inline "We couldn't save that - try again." Ready is a courtesy, never blocks Start; helper "Ready just tells the host you're set."

### 3.5 Host panel (host or Admin only; Card, h2 "Set up the game")

| Part | Spec |
| --- | --- |
| Game picker | `role="radiogroup"` label "Game". One selectable card, pre-selected, `aria-checked`: art tile, "This or That", "Pick a side, see how the room splits. 5-10 min. No scores." Selected = 2px violet700 border + Check badge + text "Selected". No other tiles, no "coming soon" |
| Rounds | NumberField "Rounds" 3-10 default 6, stepper buttons, hint "Each round is one question." |
| Seconds | NumberField "Seconds per round" 15-60 default 30 |
| Answer change | Checkbox-switch (native checkbox, 44px, label) "Let people change their answer until time is up", default off; hint "Off means the first answer is final." |
| Pack | Read-only line "Question pack: Starter" (only pack) |
| Estimate | "About 4 minutes" = rounds x (seconds + 15) rounded; text only |
| Start | Primary lg "Start This or That". Needs >= 2 connected participants: otherwise `aria-disabled` + visible text "Waiting for at least 1 more person." Pending: "Starting..." until ack/state; rejection: NOT_HOST "Only the host can do that."; SERVICE_UNAVAILABLE "We couldn't save that - try again." Field errors: "Choose 3 to 10 rounds." / "Choose 15 to 60 seconds." |
| Non-host view | In place of panel, Card: "Waiting for the host to start" + config read-only once chosen is not possible (config not broadcast), so only the message and the ready toggle; spinner replaced by a slow 3-dot pulse (static under reduced motion) |

Host-left state (host `connected=false`, or me is non-host and host row away): Notice warning "Heads up: The host has stepped away. The room stays open and they can rejoin. An organisation Admin can also take over." Shown above the code card. Admin viewing: panel enabled with no change. No auto transfer, no countdown shown.

---

## 4. Game: question phase

Page title "Round 3 of 6 - This or That - FunFriday". h1 (visually the question) is the question text; round label above it is `<p>`.

### 4.1 Layout

| Breakpoint | Layout |
| --- | --- |
| 320 (participant) | Top strip: "Round 3 of 6" left, timer right (36px numeral + Clock). Question h1 24/32 (up to 4 lines). Choice A, Choice B stacked full width, min-height 96, gap 12. Pass full width 48 height below. Answered count + status line. Shortcut hints hidden on touch (pointer: coarse) but still in `aria-keyshortcuts`. Roster dock collapsed at bottom. Bottom padding 24 (+ host bar 72 if host) |
| 768 | Question h1 30/38; choices side by side 50/50 min-height 120; Pass centred below, 320 wide |
| 1440 | Max 960 centred. Question display-lite 40/46 centred. Choices side by side 280 tall cards. Timer top right in the header strip, big 56px. Host: controls bar sticky bottom; roster as right column 280px (counts only, same rows as lobby) |

### 4.2 Header strip

"Round 3 of 6" (h4, with 6-segment progress, current segment ink filled, done = mint700 with Check, remaining outline) | Timer | "12 of 18 answered" (Users icon, `tabular-nums`).

### 4.3 Timer

| Rule | Spec |
| --- | --- |
| Source | Remaining = `deadlineAt - (Date.now() + skew)`, skew from `serverNow` of each room:state; recompute from absolute time, never decrement a counter. Display ceil seconds: "0:24" |
| Visual | Numeral + a decorative ring (mobile 40px around numeral) or bar (desktop under header, 6px, radius pill) shrinking linearly; `aria-hidden` |
| Accessible | Numeral `aria-hidden`; one visually hidden `role="timer"` element is NOT used (would chatter). Instead a polite live region announces only: round start "Round 3. 30 seconds." ; at 10s "10 seconds left"; at 5s "5 seconds left"; at close "Time's up." No per-second announcements. A static sr-only "Time left: 0:24" is refreshed only on focus of the timer region (focusable `tabindex=0` group labelled "Time left") |
| Last 5s | Numeral weight stays, add Clock icon swap to AlarmClock, bar segment coral700, 1s scale pulse 1.0->1.06 on numeral (ease-in-out). Reduced motion: no pulse, no ring/bar animation (bar jumps in 1s steps or hidden; numeral still updates) |
| Paused | See 4.8 |
| Zero | Numeral "0:00", choices become inert immediately on local time but state is authoritative: wait for reveal state; if no state within 1.5s show "Time's up. Getting the results..." |

### 4.3b Question text

Large, ink, centred (left on 320). No images. Option labels are text inside the choice buttons.

### 4.4 Choices

| Part | Spec |
| --- | --- |
| Choice A | Button-like `role="radio"` inside `role="radiogroup"` aria-label "Your answer", fallback native radio semantics; content: badge "A", option text 20/28 (28/34 at 1440), hint chip "Press 1" (hidden on coarse pointer, visible text not tooltip). `aria-keyshortcuts="1"` |
| Choice B | Same, badge "B", hint "Press 2", `aria-keyshortcuts="2"` |
| Pass | Secondary button style `choicePass`, height 48, Minus-circle icon, "Pass" + chip "Press 0", helper (small, under) "Passing is always fine." Same radio group so it can be selected and (if allowed) changed. Not hidden, never smaller than 44px |
| States | Default; hover (lift -2px + shadow-md 160ms); focus-visible ring; active press translateY(1px) 120ms; selected: 4px border, check badge top-right with CircleCheck + text "Your pick" in corner; unselected siblings after lock keep full contrast (no dimming) and are `aria-disabled`; pending: selected card shows spinner icon + "Saving..." until ack (selection shown immediately as "pending" with dashed border, reverts on rejection) |
| Keyboard | 1, 2, 0 anywhere on page except when focus is in a text field or a Dialog is open; Arrow keys move among radios; Enter/Space selects focused. Shortcuts ignored with Ctrl/Meta/Alt. Visible list "Shortcuts: 1 = A, 2 = B, 0 = Pass" (small, below Pass, hidden only on coarse pointer) |
| Send | `game:action` `{type:'answer', roundId, choice}` with fresh `clientActionId`. Ack accepted/duplicate = locked; rejected -> see 4.7 |

### 4.5 Answer status line (below choices, `aria-live="polite"`, announces only on change of the sentence)

| Condition | Copy (icon + text) |
| --- | --- |
| No answer yet | "Pick one, or pass. Your answer stays private." |
| Answered, `allowAnswerChange=false` | CircleCheck "Locked in: A, Sunrise. Waiting for everyone else." (choice B/pass analogue; pass = "Locked in: Pass.") |
| Answered, `allowAnswerChange=true` | CircleCheck "Your pick: A, Sunrise. You can change it until time is up." |
| Pending | Loader "Saving your answer..." |
| Waiting after lock, everyone not done | "12 of 18 answered" persists in header |

Count "12 of 18 answered" (`answeredCount` of `eligibleCount`) is a visible live text; its container is NOT `aria-live` (avoid chatter); the status line above carries the only announcement. 0 eligible shows "Waiting for people to join".

### 4.6 Late / closed

ROUND_CLOSED ack: inline Notice info under choices "This round just closed, so that answer wasn't counted." Selection reverts to server `myChoice`; focus stays on the pressed choice. Followed by the reveal state automatically.
INVALID_ACTION: "That answer isn't available." DUPLICATE_ACTION/`duplicate` status: silent success. CONFLICT with `allowAnswerChange=false` and a different choice: "Your first answer is final this round." RATE_LIMITED: "Slow down a little and try again." SERVICE_UNAVAILABLE / INTERNAL_ERROR: "We couldn't save that - try again." (selection reverts, choices re-enabled). OUT_OF_SYNC: silent `room:resync`.

### 4.6b Reconnecting (ConnectionBanner, all live screens)

| State | Spec |
| --- | --- |
| Reconnecting | Sticky top banner (z-60), warning tone, icon RefreshCw (static under reduced motion, else 1.2s spin), text "Reconnecting... your answer is safe." (during reveal/lobby: "Reconnecting... we'll catch you up."). `role="status"` once on appear. Choices and host buttons `aria-disabled` while down, with timer still counting from last known deadline |
| Restored | Banner swaps to mint "Back in the room" 2.5s then removed (200ms fade); `room:resync` first, view replaced by server state; selected choice restored from `myChoice` |
| Failed > 20s | Banner becomes ErrorState-style inline: "We can't reach the room." + Button "Try again" + LinkButton "Back to dashboard" |
| Timing | Banner appears after 1s of disconnect (avoid flicker) |

### 4.7 Paused

Overlay panel above choices (not a modal, page stays readable): Pause icon + "Host paused the game" body "Timer stopped at 0:17. Your answer is saved." Numeral frozen using `remainingMs`; ring/bar static; choices are `aria-disabled` while paused (own pick stays shown) with text "Answers reopen when the host resumes." Host sees "Resume" button in the controls bar. Polite announce "Game paused" and "Game resumed. 17 seconds left."

---

## 5. Reveal

Page title "Results - Round 3 of 6 - FunFriday". Question stays (h1, smaller 24/32). Header "Round 3 of 6 - Results".

| Part | Spec |
| --- | --- |
| Sentence (h2, always visible, first in DOM) | "11 picked Sunrise, 6 picked Sunset, 1 passed." Variants: singular "1 picked Sunrise"; zero omitted: "7 picked Sunrise, 7 picked Sunset." ; all pass "Everyone passed - and that's fine."; total 0 "Nobody answered this round." ; tie "The room split evenly: 9 and 9." Never use "majority/minority" |
| Bars | Three rows (A, B, Pass). Each: label badge + option text, bar track (height 40, radius 12, white, 1px borderStrong), fill width = pct, count + percent inside/right as text "11 - 61%" (`tabular-nums`, ink text on white always; never text over a fill). Fills: A solid violet700, B hatch `barPatternB`, Pass dotted muted. Percentages sum rounding: largest remainder so total = 100 |
| Own pick | The row of my choice shows text chip "Your pick" with Check icon (self only; others unknown) |
| Table alternative | The three rows are a semantic `<ul>`; each `li` reads "Sunrise, 11 people, 61 percent"; bars `aria-hidden` |
| Small rooms | eligible < 5: show counts only (no percentages), sentence "Most picks stay private in small groups: 3 answered." Rule from game spec: no phrasing that implies who voted how |
| Host prompt | Host only, Card sun50 with Lightbulb icon, caption "Conversation starter (only you can see this)", text from static list cycled by round number: "Ask: anyone want to share why?", "Ask: what would change your pick?", "Ask: who has a favourite story about this?". Helper "Invite, don't call people out." Participants see instead a quiet line "Talk it over - speaking is always optional." |
| Participant footer | "Waiting for the host to start the next round." (last round: "Waiting for the host to wrap up.") |

Motion: bars grow from 0 to pct over 400ms `duration-meter`, stagger 80ms per row (A, B, Pass) = 560ms total; counts count-up over `duration-count` 480ms each, starting with bar; sentence fades in 200ms first. Reduced motion: final numbers and widths immediately, no stagger.

---

## 6. Host controls bar

Visible only when `me.isHost` or role Admin. Sticky bottom, z-20, surface, top border 1px, shadow-md up, padding 12/16 + safe-area inset, height 72. Landmark `<section aria-label="Host controls">`.

| Breakpoint | Layout |
| --- | --- |
| 320 | Primary action full width row 1 (md 48). Row 2: secondary actions as an icon+label 3-up grid (Pause, End game, More) each min 44x56 with 12/600 label under icon. "End session" lives inside "More" (opens bottom sheet Dialog). No horizontal scroll |
| 768 | One row: primary left, secondary icons with labels, destructive right |
| 1440 | One row inside 960 container: primary, Pause, End game, divider, "End session" ghost danger |

### 6.1 Buttons by phase

| Phase | Primary | Secondary | Destructive |
| --- | --- | --- | --- |
| lobby | (Start lives in panel) | | "End session" |
| question | "Close round" (primary, Lock icon) with caption "12 of 18 answered" | "Pause" (Pause icon) | "End game" (danger ghost), "End session" |
| paused | "Resume" (primary, Play) | "Close round" | End game, End session |
| reveal | "Next round" (primary, ArrowRight); on last round label "Finish game" (Flag) | | End game, End session |
| finished | "Play again" (primary) | | "End session" |

### 6.2 Command behaviour

| Rule | Spec |
| --- | --- |
| Pending | Tap -> that button `aria-busy`, label "Closing...", "Pausing...", "Resuming...", "Moving on...", "Finishing..."; all other bar buttons `aria-disabled` until ack. UI state changes ONLY when `room:state` arrives (no optimistic change). Timeout 5s without ack -> pending ends with error |
| Success | `accepted`: nothing extra (state change is the feedback); focus: after Close round move focus to the reveal sentence h2; after Next round to the question h1 (tabindex -1); after Pause to Resume button |
| Rejections | NOT_HOST "Only the host can do that." ; CONFLICT/ROUND_CLOSED "That already happened - the room is up to date." (resync); RATE_LIMITED "One moment, then try again."; SERVICE_UNAVAILABLE "We couldn't save that - try again." Displayed in an inline `role="alert"` line above the bar (once), auto-clears on next success |
| Shortcuts | Host: `Shift+N` Next/Finish, `Shift+C` Close round, `Shift+P` Pause/Resume (listed under "More" > "Shortcuts"; not triggered while typing). Never conflicts with 1/2/0 |
| Reconnecting | All commands `aria-disabled`, caption "Waiting to reconnect" |

### 6.3 Confirm dialogs (Dialog component, focus on Cancel, focus returns to trigger)

| Action | Title | Body | Buttons |
| --- | --- | --- | --- |
| End game | "End this game now?" | "Everyone will see the summary so far. Rounds not played won't be counted." | "Keep playing" (default) / "End game" (danger) |
| End session | "End the session for everyone?" | "The room closes and people go back to the dashboard. You can't reopen it." | "Keep session open" (default) / "End session" (danger, label while pending "Ending...") |
| Close round early | no dialog (reversible, low risk) | | |

---

## 7. Summary (game.phase `finished`, uses `game.summary` or `lastSummary`)

Page title "Summary - This or That - FunFriday". h1 "That was a good one" (fixed copy, no scores).

| Part | Spec |
| --- | --- |
| Highlight cards (2 col at >=768, stacked at 320) | "Most united moment": Heart icon, "18 of 20 picked Sunrise" + question small, "Round 3". Hidden if `mostUnited` null. "Closest split": Scale icon, "Round 5 was 10 to 10" + question. Hidden if null. Mint50 and sun50 tone, text ink |
| Per-round list | h2 "Round by round". `<ol>` cards: "Round 1: Sunrise or sunset?" then the same sentence as reveal "11 picked Sunrise, 6 picked Sunset, 1 passed." + compact bar pair (decorative, 12px) + counts. No highlighting of any person, no ordering by score (order = round number) |
| Small rooms | counts only (no percentages) when total < 5 |
| Footer note | "Individual answers aren't saved. Only these totals are kept." (Lock icon) |
| Celebration | One-time confetti-ish ring burst behind the cards, <= 1.5s, 12 particles in violet/coral/mint/sun on `aria-hidden` canvas, `pointer-events:none`; reduced motion: none (cards fade 0ms). Never repeats on resync |
| Host actions | "Play again" (primary; returns to lobby config panel with the previous values prefilled; roster stays) and "End session" (confirm) |
| Participant actions | "Back to dashboard" (LinkButton primary), caption "The host may start another game - stay if you'd like to play again." (stays in room, will move to lobby when host plays again) |
| Empty | No rounds played (host ended immediately): EmptyState "No rounds were played" + same actions |

Mobile: highlight cards then list; actions sticky bottom (host: replaces controls bar).

---

## 8. Participant vs host layouts and roster dock

| Aspect | Participant (mobile-first) | Host (desktop/tablet first, works on phone) |
| --- | --- | --- |
| Chrome | No sidebar/bottom nav during a game (focus mode): slim header with LogoMark, session title, "Leave" ghost button (confirm Dialog "Leave the session?" body "You can rejoin with the code." / "Stay" default / "Leave") | Same, plus sticky host bar |
| Question | Choices full width, thumb zone bottom | Choices + right column roster + count |
| Extras | Own pick, shortcuts (desktop) | Facilitation card on reveal, answered count with names never shown |

Roster dock (phones <768): bottom-anchored bar above host bar, height 48, text button "5 in the room (3 ready)" (Users icon, chevron) `aria-expanded`, `aria-controls`. Expanded: bottom sheet (max 60% height, rounded top 20, shadow-lg) listing same rows as 3.3, enter 200ms slide up, Esc/close button (44px "Close people list") dismiss, focus moves to sheet heading and returns to the dock button; not a modal trap (page behind stays inert not required; no scrim). During question phase the dock shows presence only (ready is lobby only). At >=768 the roster is a normal card/column.

---

## 9. Session ended, errors, loading

| Screen | Spec (all: h1 + one primary action) |
| --- | --- |
| Session ended (`status: ended`, or `end_session` received) | Full page EmptyState with motif: h1 "This session has ended", body "Thanks for playing. Hosts can start a new one anytime." Primary "Back to dashboard". If summary exists (`lastSummary`): secondary "See the summary" (read-only summary view, section 7 without actions). Auto: focus h1, polite "The host ended the session" |
| ROOM_NOT_FOUND | ErrorState (neutral tone, Lock icon not red): h1 "This session isn't available", body "It may have ended, or the code may be wrong. Check with your host." Primary "Back to dashboard", secondary "Join with a code" |
| FORBIDDEN / TENANT_MISMATCH | Same screen and same copy as ROOM_NOT_FOUND (no information leak) |
| ROOM_FULL | "This room is full" body "Ask your host if there's space, then try again." Primary "Try again" |
| UNAUTHENTICATED | Redirect to sign-in with return path; if expired mid-game banner "Your sign-in expired. Sign in again to rejoin - your answer is safe." |
| RATE_LIMITED | Banner/inline "Too many requests. Wait a moment and try again." Retry after 3s |
| SERVICE_UNAVAILABLE / INTERNAL_ERROR | "We couldn't save that - try again." (inline for actions); full-page for join: h1 "We couldn't open the room" + Retry |
| Loading join | Skeleton: header line + big block + 3 roster lines; "Joining the room..." sr-only status; max 3s then error |
| Page-level crash | Next error boundary: "Something went wrong" + Retry + dashboard link |

---

## 10. Motion table

| Moment | Motion | Duration / easing | Reduced motion |
| --- | --- | --- | --- |
| Live route enter | fade + 8px rise | 200ms ease-out | none |
| Roster row join | fade + 8px | 200ms | none |
| Phase change (lobby/question/reveal/summary) | content cross-fade (no layout slide) | 200ms | instant |
| Choice press | translateY(1px) | 120ms | none (outline remains) |
| Choice select | border thickens + badge pop scale .9->1 | 160ms | instant |
| Timer ring/bar | linear depletion | realtime | static numeral only |
| Last 5s pulse | numeral scale 1->1.06, 1s loop | ease-in-out | none |
| Reveal sentence | fade | 200ms | instant |
| Reveal bars | grow, 80ms stagger A/B/Pass | 400ms ease-in-out | instant |
| Reveal counts | count-up | 480ms ease-out | final value |
| Roster dock sheet | slide up 24px + fade | 200ms | instant |
| Connection banner | slide down 8px + fade; spinner 1.2s | 200ms | instant, static icon |
| Copy confirmation | label swap | 0ms, revert 2s | same |
| Summary celebration | 12-particle burst | <= 1.5s | none |
| Ready toggle | colour/icon swap | 160ms | instant |

No looping motion except spinner and last-5s pulse; none auto-plays after 1.5s.

---

## 11. Copy deck (exact)

| Key | Copy |
| --- | --- |
| Dashboard block h2 | Live sessions |
| Start CTA / loading | Start a live session / Opening room... |
| Join CTA / loading | Join session / Joining... |
| Join label / hint | Room code / 6 characters, like K7P2QM. Capitals and spaces don't matter. |
| No active sessions | No live sessions right now / When someone opens a room it appears here. |
| Lobby code caption | Room code |
| Copy | Copy code / Code copied / Copy link / Link copied |
| Ready | I'm ready / You're ready - tap to undo / Ready just tells the host you're set. |
| Presence | Connected / Away |
| Roster empty | Just you so far / Share the code above. You need at least 2 people to start. |
| Start | Start This or That / Waiting for at least 1 more person. |
| Waiting (participant) | Waiting for the host to start |
| Host away | Heads up: The host has stepped away. The room stays open and they can rejoin. An organisation Admin can also take over. |
| Status none | Pick one, or pass. Your answer stays private. |
| Locked | Locked in: A, Sunrise. Waiting for everyone else. |
| Changeable | Your pick: A, Sunrise. You can change it until time is up. |
| Saving | Saving your answer... |
| Count | 12 of 18 answered |
| Announce | Round 3. 30 seconds. / 10 seconds left / 5 seconds left / Time's up. |
| Closed | This round just closed, so that answer wasn't counted. |
| Reconnecting | Reconnecting... your answer is safe. / Back in the room |
| Paused | Host paused the game / Timer stopped at 0:17. Your answer is saved. / Answers reopen when the host resumes. |
| Reveal sentence | 11 picked Sunrise, 6 picked Sunset, 1 passed. |
| Everyone passed | Everyone passed - and that's fine. |
| Host prompt | Ask: anyone want to share why? |
| Participant reveal | Talk it over - speaking is always optional. / Waiting for the host to start the next round. |
| Host buttons | Close round / Next round / Finish game / Pause / Resume / End game / End session |
| Summary | That was a good one / Most united moment / Closest split / Round by round / Individual answers aren't saved. Only these totals are kept. |
| Summary actions | Play again / End session / Back to dashboard |
| Ended | This session has ended / Thanks for playing. Hosts can start a new one anytime. |
| Errors | This session isn't available / Too many requests. Wait a moment and try again. / We couldn't save that - try again. / Only the host can do that. |

Names: use `participants[].name`; if null, "Teammate". Never put names in reveal/summary.

---

## 12. Acceptance checklist (screenshot + manual review)

Capture each at 320, 768, 1440, default and reduced motion where noted. Mark verified only after rendering.

| # | Check |
| --- | --- |
| 1 | Dashboard: Start card absent for Participant, present for Host/Admin; join accepts "k7p 2qm" |
| 2 | Lobby: code, copy buttons, roster rows show text for presence AND ready; empty lobby; host-left Notice; host panel with the single game card; Start `aria-disabled` with reason when alone |
| 3 | Question: question, A, B, Pass all >= 44px, hints "Press 1/2/0" visible on desktop, count, timer; no horizontal scroll at 320 |
| 4 | Selected, pending, locked, changeable states each distinguishable in greyscale |
| 5 | Timer: only 10s/5s/close announced (screen reader log shows no per-second output); pulse absent with reduced motion |
| 6 | Paused and reconnecting banners; choices `aria-disabled` and explained |
| 7 | ROUND_CLOSED message shown, selection reverted to server value |
| 8 | Reveal: sentence + counts + percentages visible, bars hatched/solid differ, own pick chip, host prompt only for host, no names anywhere |
| 9 | Reveal singular/zero/all-pass/tie/small-room copy variants |
| 10 | Host bar sticky and usable at 320 (no overlap with roster dock or content bottom padding); pending states; dialogs focus Cancel and return focus |
| 11 | Summary: both highlights (and hidden when null), per-round list, no rank, celebration <= 1.5s and off in reduced motion, host vs participant actions |
| 12 | Ended screen and ROOM_NOT_FOUND copy exact; no leak for other-org codes |
| 13 | Keyboard-only run of whole flow (join, ready, start, answer 1/2/0, host commands, dialogs); focus visible everywhere; focus moves per 6.2 |
| 14 | Screen reader pass (VoiceOver/NVDA): headings, radiogroup, live regions not noisy |
| 15 | Contrast pairs from section 1 in `tokens.test.ts`; 200% zoom reflow; forced-colors keeps borders |
| 16 | Honesty: no dead buttons, no fake participants or games, no names in aggregates |

---

## 13. Open questions

1. Is there a command to return to lobby after `finished`? Contract has only `start_game`; "Play again" assumes `start_game` is accepted from `finished` with a new config (UI would show the lobby config panel client-side only). Confirm.
2. Is "ready" meant to gate Start? Spec says no (courtesy only). Confirm.
3. Facilitation prompts and the "theme highlight" from the game spec are not in the view; this spec uses a static client list and omits theme highlight. OK, or add to contract?
4. Host-skip a prompt exists in `this-or-that.md` but there is no `skip` host command; omitted from UI.
5. Summary for non-participants who joined late (no per-person data) is the same view; confirm.
