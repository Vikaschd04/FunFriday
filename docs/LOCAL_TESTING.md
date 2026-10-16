# Testing FunFriday Locally

Owner direction (D009): FunFriday is tested on your own machine until there is a usable UI; hosting is decided afterwards. This guide is for trying the product by hand and running the automated checks.

## 1. One-time setup

Prerequisites: Node.js 22.12+, pnpm 11.20+, Docker with Compose (Docker Desktop or Colima), about 4 GB free disk.

```bash
git clone https://github.com/Vikaschd04/FunFriday.git
cd FunFriday
pnpm install
cp .env.example .env                                   # development-only sample values
pnpm --filter @funfriday/web exec playwright install   # browsers for automated UI tests (optional)
```

## 2. Start everything

```bash
colima start          # only if you use Colima instead of Docker Desktop
pnpm db:up            # Postgres 17 + Redis 7 on 127.0.0.1
pnpm db:migrate       # apply database migrations
pnpm db:seed          # load the six-activity catalog (safe to repeat)
pnpm dev              # web http://localhost:3000 · API http://localhost:4000/api/v1
```

Stop with `Ctrl+C`, then `pnpm db:down` (and `colima stop`) when you are done.

## 3. What to try

### 3a. Accounts and organisations (P2)

No real email is sent. Verification messages land in a local **dev mailbox** at `http://localhost:3000/dev/mailbox` (only when `DEV_MAILBOX_ENABLED=true`, which `.env.example` sets for local use).

| Try this | You should see |
| --- | --- |
| `/sign-up` with your name, any email (e.g. `ana@example.test`) and a 12+ character password | You land in the app, signed in, with a "verify your email" notice |
| Open `/dev/mailbox` and use the verification link | `/app?verified=1` with a success message |
| Create your organisation | You become its Admin; Members, Teams and Audit log appear |
| Members -> Add member `sam@example.test` as Participant | "Invitation sent to sam@example.test. They'll join after accepting it." (same message whether or not the account exists) |
| **Second person:** open a private/incognito window (or another browser), open `/dev/mailbox`, use the invitation link, create an account as `sam@example.test` and press Join | Sam now sees your organisation, read-only, with no email addresses and no Audit log. Accepting the invitation also verifies Sam's email |
| Open the same invitation link again | "This invitation link isn't valid or has already been used." |
| Back as Admin: change Sam's role to Host | Sam can now create teams; the change appears in the Audit log |
| As Admin, try to demote yourself while you're the only Admin | A clear "at least one admin" message; nothing changes |
| Sign out, then open `/app` | You're sent to sign-in, and returned to the page you wanted afterwards |

Two windows in the same normal browser profile share one session; use a private window or a different browser for the second person.

### 3c. Play This or That live (P4)

You need at least two people (two browsers or a private window), both members of the same organisation (see 3a).

| Try this | You should see |
| --- | --- |
| As Admin/Host on the dashboard: **Start a live session** | A lobby with a big 6-character room code |
| Second person: dashboard -> **Join with a code** (lowercase and spaces are fine) | They appear in the lobby roster; "I'm ready" shows for everyone |
| Host: choose rounds/seconds and **Start** This or That | Everyone sees the same question and countdown |
| Answer with the buttons or keys **1** / **2** / **0** (Pass) | "N of M answered" updates on every screen; you can change your answer until time is up |
| Host: **+15 s**, **Pause/Resume**, **Close round** | Countdown changes for everyone at once |
| Reveal | Counts and percentages for the group - never who chose what |
| Reload a participant's page mid-round | They come back to the same round with their answer kept |
| Host: **Finish** | Summary with "most united moment" and "closest split"; **Play again** or **End session** |

### 3b. Planning (P1)

Everything below runs on real data from your local API. Event plans are still saved **in your browser only** (server-saved events arrive in P3).

| Where | Try this | You should see |
| --- | --- | --- |
| `http://localhost:3000/` | Read the landing page; use "Plan a FunFriday" and "Explore activities" | Both buttons open real screens |
| `/app/library` | Search "trivia"; toggle category chips; pick group size "21-50 people" | Results filter instantly; Sketch & Guess hides with a capacity note; filters survive a page reload |
| `/app/library` | "Plan with this activity" on any card | The planner opens with that activity already added |
| `/app/events/new` | Leave fields empty and press Next | An error summary that links to each field |
| `/app/events/new` | Time zone "America/New_York", date 2026-03-08, time 02:30 | A clear message that this time is skipped when clocks change |
| `/app/events/new` | Add three activities, reorder them with the arrow buttons, set minutes above the event length | The runtime meter shows you are over time, in words as well as colour |
| `/app/events/new` | Reach Review, then "Save draft on this device" | Agenda with start/end times in the event zone and in your own zone; "Draft saved" |
| `/app` | Open the dashboard | Your draft, "Continue editing" and "Delete" (with a confirmation dialog) |
| `/status` | Open the status page; stop Redis (`docker stop funfriday-dev-redis-1`) and press "Check again" | "Degraded service - Not responding: Realtime service"; start it again with `docker start funfriday-dev-redis-1` |
| Keyboard only | Tab through any page; use the skip link | Visible focus on every control; everything reachable |
| Phone size | Browser dev tools at 320-390px wide | Bottom tab bar, no sideways scrolling |
| Reduced motion | Turn on "Reduce motion" in your OS settings | Entrance animations and spinners stop |

Not built yet (by design, later phases): password reset, real email delivery, saving events to the server, event invitations, joining with a code, live games.

## 4. Reset local data

- Drafts: they live in this browser's local storage. Delete them from the dashboard, or clear site data for `localhost:3000`.
- Accounts and organisations: they live in the local database; reset it as below to start over.
- Database: `pnpm db:down`, then `docker volume rm funfriday-dev_postgres_data`, then repeat section 2. This deletes **only** FunFriday's local database.

## 5. Automated checks (same as CI)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:integration      # needs `pnpm db:up`
CI=1 pnpm test:e2e         # Chromium, Firefox, WebKit against the real API (stop `pnpm dev` first: it uses ports 3000/4000)
pnpm test:load             # needs a running API (`pnpm --filter @funfriday/api start`)
```

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `pnpm install` fails with no message | Check free disk space (`df -h`); pnpm needs room for its store |
| `pnpm db:up` cannot connect to Docker | Start Docker Desktop or run `colima start` |
| Status page says "API unreachable" | Is `pnpm dev` running? Is port 4000 free (`lsof -i :4000`)? |
| Integration tests complain about `TEST_DATABASE_URL` | Copy `.env.example` to `.env`; if your Postgres volume is older than the test database, see `docs/SETUP.md` |
| Port 3000/4000 already in use | Stop the other process or the earlier `pnpm dev` |
| API exits with `Invalid or missing environment variables: AUTH_SECRET` | Add `AUTH_SECRET` to `.env` (`openssl rand -base64 32`), see `.env.example` |
| "Too many attempts" on sign-in/up | Auth is rate limited to 5 tries a minute per address; wait a minute |
