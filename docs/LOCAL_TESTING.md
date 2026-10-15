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

## 3. What to try (P1 build)

Everything below runs on real data from your local API. Nothing is sent, shared or emailed; event plans are saved **in your browser only**.

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

Not built yet (by design, later phases): sign-in, organisations, saving events to the server, invitations, joining with a code, live games.

## 4. Reset local data

- Drafts: they live in this browser's local storage. Delete them from the dashboard, or clear site data for `localhost:3000`.
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
