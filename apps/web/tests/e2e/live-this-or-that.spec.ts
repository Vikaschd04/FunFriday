import type { Page } from '@playwright/test';
import { anonTest, expect, newActor, seedOrgWithMembers, WEB_ORIGIN } from './fixtures';
import {
  expectNoHorizontalScroll,
  expectNoSeriousAxeViolations,
  settleAnimations,
} from './helpers';

type Pick = 'A' | 'B' | 'Pass';
const radio = (page: Page, pick: Pick) =>
  page.getByRole('radio', { name: pick === 'Pass' ? /^Pass/ : new RegExp(`^${pick}\\b`) });
const status = (page: Page) => page.getByTestId('answer-status');
const hostBar = (page: Page) => page.getByRole('region', { name: 'Host controls' });

async function startSession(host: Page, title: string): Promise<string> {
  await host.goto('/app');
  await host.getByLabel('Session title (optional)').fill(title);
  await host.getByRole('button', { name: 'Start a live session' }).first().click();
  await host.waitForURL(/\/app\/live\/[0-9a-f-]{36}/);
  // The first socket join can queue behind password hashing from parallel workers.
  await expect(host.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  });
  const code = (await host.getByTestId('room-code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  return code;
}

async function joinWithCode(page: Page, code: string, title: string): Promise<void> {
  await page.goto('/app');
  // Lowercase with a space: the form normalises it.
  await page.getByLabel('Room code').fill(`${code.slice(0, 3)} ${code.slice(3)}`.toLowerCase());
  await page.getByRole('button', { name: 'Join session' }).click();
  await page.waitForURL(/\/app\/live\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 15_000,
  });
}

/** Answer shortcuts only act while focus is inside the game panel, so land there first. */
async function press(page: Page, key: string): Promise<void> {
  await page.locator('[data-live-heading]').focus();
  await page.keyboard.press(key);
}

async function startGame(
  host: Page,
  rounds: number,
  seconds: number,
  allowChange = true,
): Promise<void> {
  await host.getByLabel('Rounds', { exact: true }).fill(String(rounds));
  await host.getByLabel('Seconds per round', { exact: true }).fill(String(seconds));
  if (!allowChange) {
    await host.getByLabel('Let people change their answer until time is up').uncheck();
  }
  await host.getByRole('button', { name: 'Start This or That' }).click();
}

anonTest.describe('live session: This or That', () => {
  anonTest(
    'host and two participants play a full game in separate browsers',
    async ({ browser, baseURL }) => {
      anonTest.setTimeout(180_000);
      const { admin, members } = await seedOrgWithMembers(browser, baseURL ?? WEB_ORIGIN, 2);
      const host = admin.page;
      const [mia, noor] = [members[0]!.page, members[1]!.page];
      const title = 'Friday smoke session';

      // Lobby: code, join by code, roster, ready.
      const code = await startSession(host, title);
      await expect(hostBar(host)).toBeVisible();
      await expect(host.getByText('Waiting for at least 1 more person.')).toBeVisible();
      await joinWithCode(mia, code, title);
      await joinWithCode(noor, code, title);
      await expect(host.getByText(/^3 connected/)).toBeVisible();
      await expect(host.getByText('Waiting for at least 1 more person.')).toHaveCount(0);
      // A participant sees no host controls and no setup panel.
      await expect(hostBar(mia)).toHaveCount(0);
      await expect(
        mia.getByRole('heading', { name: 'Waiting for the host to start' }),
      ).toBeVisible();
      await mia.getByRole('button', { name: "I'm ready" }).click();
      await expect(mia.getByRole('button', { name: "You're ready - tap to undo" })).toBeVisible();
      await expect(host.getByText(/1 ready/)).toBeVisible();

      // Round 1: mouse + keyboard; host closes the round with one person still undecided.
      await startGame(host, 3, 60, false);
      for (const page of [host, mia, noor]) {
        await expect(radio(page, 'A')).toBeVisible();
        await expect(page.getByText('Round 1 of 3', { exact: true })).toBeVisible();
      }
      await expect(hostBar(mia)).toHaveCount(0);
      await radio(host, 'A').click();
      await expect(status(host)).toContainText('Locked in: A');
      await press(mia, '2');
      await expect(status(mia)).toContainText('Locked in: B');
      for (const page of [host, mia, noor]) {
        await expect(page.getByTestId('answered-count')).toHaveText('2 of 3 answered');
      }
      // Locked: a different choice is inert (answer change is off).
      await expect(radio(mia, 'A')).toHaveAttribute('aria-disabled', 'true');
      await expect(radio(mia, 'B')).toHaveAttribute('aria-checked', 'true');
      await host.getByRole('button', { name: 'Close round' }).click();
      for (const page of [host, mia, noor]) {
        const results = page.getByTestId('results');
        await expect(results.locator('[data-row="a"]')).toContainText(/, 1 person/);
        await expect(results.locator('[data-row="b"]')).toContainText(/, 1 person/);
        await expect(results.locator('[data-row="pass"]')).toContainText(/, 0 people/);
        await expect(results).not.toContainText(/Admin Ana|Member Mia|Member Noor/);
      }
      await expect(mia.getByText('Your pick').first()).toBeVisible();
      await expect(host.getByText('Conversation starter (only you can see this)')).toBeVisible();
      await expect(mia.getByText('Conversation starter (only you can see this)')).toHaveCount(0);
      await expect(noor.getByText('Waiting for the host to start the next round.')).toBeVisible();

      // Round 2: a participant reloads mid-round and keeps their locked-in choice.
      await host.getByRole('button', { name: 'Next round' }).click();
      for (const page of [host, mia, noor])
        await expect(page.getByText('Round 2 of 3', { exact: true })).toBeVisible();
      await press(mia, '1');
      await expect(status(mia)).toContainText('Locked in: A');
      await press(noor, '0');
      await expect(status(noor)).toContainText('Locked in: Pass');
      await noor.reload();
      await expect(status(noor)).toContainText('Locked in: Pass');
      await expect(radio(noor, 'Pass')).toHaveAttribute('aria-checked', 'true');
      await expect(noor.getByTestId('answered-count')).toHaveText('2 of 3 answered');
      // Last answer ends the round early on every screen.
      await radio(host, 'B').click();
      for (const page of [host, mia, noor]) {
        await expect(page.getByTestId('results')).toBeVisible();
      }

      // Round 3: pause / resume, then finish.
      await host.getByRole('button', { name: 'Next round' }).click();
      for (const page of [host, mia, noor])
        await expect(page.getByText('Round 3 of 3', { exact: true })).toBeVisible();
      await host.getByRole('button', { name: 'Pause' }).click();
      for (const page of [host, mia, noor]) {
        await expect(page.getByText('Host paused the game')).toBeVisible();
      }
      await expect(radio(mia, 'A')).toHaveAttribute('aria-disabled', 'true');
      await host.getByRole('button', { name: 'Resume' }).click();
      for (const page of [host, mia, noor]) {
        await expect(page.getByText('Host paused the game')).toHaveCount(0);
      }
      await radio(host, 'A').click();
      await press(mia, '1');
      await press(noor, '2');
      for (const page of [host, mia, noor]) await expect(page.getByTestId('results')).toBeVisible();
      await expect(host.getByRole('button', { name: 'Finish game' })).toBeVisible();
      await expect(noor.getByText('Waiting for the host to wrap up.')).toBeVisible();
      await host.getByRole('button', { name: 'Finish game' }).click();
      for (const page of [host, mia, noor]) {
        await expect(
          page.getByRole('heading', { level: 1, name: 'That was a good one' }),
        ).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Round by round' })).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: /^Round 1:/ })).toHaveCount(1);
      }
      await expect(host.getByRole('button', { name: 'Play again' })).toBeVisible();
      await expect(mia.getByRole('link', { name: 'Back to dashboard' })).toBeVisible();

      // End the session: confirm dialog, then everyone sees the ended screen.
      await host.getByRole('button', { name: 'End session' }).first().click();
      const dialog = host.getByRole('dialog', { name: 'End the session for everyone?' });
      await expect(dialog.getByRole('button', { name: 'Keep session open' })).toBeFocused();
      await dialog.getByRole('button', { name: 'End session' }).click();
      for (const page of [host, mia, noor]) {
        await expect(
          page.getByRole('heading', { level: 1, name: 'This session has ended' }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'See the summary' })).toBeVisible();
      }
      await Promise.all(
        [admin, ...members].map(async (a) => {
          await a.context.close();
        }),
      );
    },
  );

  anonTest(
    'non-members and unknown sessions get the neutral unavailable screen',
    async ({ browser, baseURL }) => {
      anonTest.setTimeout(90_000);
      const { admin, members } = await seedOrgWithMembers(browser, baseURL ?? WEB_ORIGIN, 1);
      const outsider = await newActor(browser, baseURL ?? WEB_ORIGIN, 'Outsider Otis');
      await startSession(admin.page, 'Private room');
      const url = admin.page.url();
      await outsider.page.goto(url);
      await expect(
        outsider.page.getByRole('heading', { level: 1, name: "This session isn't available" }),
      ).toBeVisible();
      await expect(outsider.page.getByText('Private room')).toHaveCount(0);
      await outsider.page.goto('/app/live/00000000-0000-4000-8000-000000000000');
      await expect(
        outsider.page.getByRole('heading', { level: 1, name: "This session isn't available" }),
      ).toBeVisible();
      // Joining with a wrong code shows the dashboard error, never another org's session.
      await members[0]!.page.goto('/app');
      await members[0]!.page.getByLabel('Room code').fill('ZZZZZZ');
      await members[0]!.page.getByRole('button', { name: 'Join session' }).click();
      await expect(members[0]!.page.getByText(/We couldn't find an open session/)).toBeVisible();
      await members[0]!.page.getByLabel('Room code').fill('K7P0');
      await members[0]!.page.getByRole('button', { name: 'Join session' }).click();
      await expect(members[0]!.page.getByText(/Enter the 6-character code/)).toBeVisible();
      for (const a of [admin, outsider, ...members]) await a.context.close();
    },
  );

  anonTest(
    'axe, 320px reflow and reduced motion on lobby, question, reveal and summary',
    async ({ browser, baseURL }) => {
      anonTest.setTimeout(240_000);
      const { admin, members } = await seedOrgWithMembers(browser, baseURL ?? WEB_ORIGIN, 1);
      const host = admin.page;
      const mia = members[0]!.page;
      await mia.emulateMedia({ reducedMotion: 'reduce' });
      const title = 'A11y session';
      const code = await startSession(host, title);
      await joinWithCode(mia, code, title);
      await expect(host.getByText(/^2 connected/)).toBeVisible();

      const audit = async (name: string, ready: () => Promise<void>) => {
        for (const page of [host, mia]) {
          for (const width of [320, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await ready();
            await settleAnimations(page);
            await expectNoHorizontalScroll(page);
            await expectNoSeriousAxeViolations(page);
          }
        }
        expect(name).toBeTruthy();
      };

      await audit('lobby', () => expect(host.getByTestId('room-code')).toBeVisible());
      await host.setViewportSize({ width: 1440, height: 900 });
      await startGame(host, 3, 60);
      await expect(radio(host, 'A')).toBeVisible();
      await expect(radio(mia, 'A')).toBeVisible();
      await audit('question', () => expect(radio(host, 'B')).toBeVisible());
      await radio(host, 'A').click();
      await press(mia, '2');
      await expect(host.getByTestId('results')).toBeVisible();
      // Reduced motion: final numbers render immediately.
      await expect(mia.getByTestId('results').locator('[data-row="a"]')).toContainText(/1 person/);
      await audit('reveal', () => expect(host.getByTestId('results')).toBeVisible());
      await host.getByRole('button', { name: 'End game' }).first().click();
      await host
        .getByRole('dialog', { name: 'End this game now?' })
        .getByRole('button', { name: 'End game' })
        .click();
      await expect(
        host.getByRole('heading', { level: 1, name: 'That was a good one' }),
      ).toBeVisible();
      await expect(
        mia.getByRole('heading', { level: 1, name: 'That was a good one' }),
      ).toBeVisible();
      await audit('summary', () =>
        expect(host.getByRole('heading', { level: 1, name: 'That was a good one' })).toBeVisible(),
      );

      // Play again returns the host to the setup panel with values kept.
      await host.setViewportSize({ width: 1440, height: 900 });
      await host.getByRole('button', { name: 'Play again' }).click();
      await expect(host.getByLabel('Rounds', { exact: true })).toHaveValue('3');
      await startGame(host, 3, 60);
      await expect(radio(mia, 'A')).toBeVisible();
      await expect(mia.getByText('Round 1 of 3', { exact: true })).toBeVisible();
      for (const a of [admin, ...members]) await a.context.close();
    },
  );
  anonTest(
    'shortcuts are scoped and switchable, +15 s extends, host controls stay reachable',
    async ({ browser, baseURL, browserName }) => {
      anonTest.setTimeout(240_000);
      const { admin, members } = await seedOrgWithMembers(browser, baseURL ?? WEB_ORIGIN, 1);
      const host = admin.page;
      const mia = members[0]!.page;
      const title = 'Controls session';
      const code = await startSession(host, title);
      await expect(host).toHaveTitle('Lobby - FunFriday');
      await joinWithCode(mia, code, title);
      await expect(host.getByText(/^2 connected/)).toBeVisible();
      // Defaults: at least 20 s rounds, answers can be changed.
      await expect(
        host.getByLabel('Let people change their answer until time is up'),
      ).toBeChecked();
      await startGame(host, 3, 60);
      await expect(radio(mia, 'A')).toBeVisible();
      await expect(mia).toHaveTitle('Round 1 of 3 - FunFriday');

      // 1) Focus outside the game panel: the key does nothing.
      await mia.getByRole('button', { name: 'Leave' }).focus();
      await mia.keyboard.press('1');
      await expect(status(mia)).toContainText('Pick one, or pass');

      // 2) Shortcuts off: the key does nothing even inside the panel, and the hint is gone.
      const toggle = mia.getByRole('checkbox', { name: 'Keyboard shortcuts' });
      await toggle.uncheck();
      await expect(radio(mia, 'A')).not.toHaveAttribute('aria-keyshortcuts', /.*/);
      await press(mia, '1');
      await expect(status(mia)).toContainText('Pick one, or pass');
      await mia.reload();
      await expect(radio(mia, 'A')).toBeVisible();
      await expect(mia.getByRole('checkbox', { name: 'Keyboard shortcuts' })).not.toBeChecked();
      await press(mia, '1');
      await expect(status(mia)).toContainText('Pick one, or pass');

      // 3) Back on: works inside the panel, and an answer can be changed until time is up.
      await mia.getByRole('checkbox', { name: 'Keyboard shortcuts' }).check();
      await expect(radio(mia, 'A')).toHaveAttribute('aria-keyshortcuts', '1');
      await press(mia, '1');
      await expect(status(mia)).toContainText('Your pick: A');
      await press(mia, '2');
      await expect(status(mia)).toContainText('Your pick: B');
      await expect(host.getByTestId('answered-count')).toHaveText('1 of 2 answered');

      // 4) +15 s moves the countdown for everyone and is announced politely.
      const seconds = async (page: Page): Promise<number> => {
        const text = (await page.getByTestId('timer').textContent()) ?? '0:00';
        const [m, s] = text.split(':').map(Number);
        return (m ?? 0) * 60 + (s ?? 0);
      };
      const before = await seconds(host);
      await host.getByRole('button', { name: /^\+15 s/ }).click();
      await expect.poll(() => seconds(mia)).toBeGreaterThan(before + 5);
      await expect(mia.getByRole('status').filter({ hasText: 'Time extended' })).toHaveCount(1);

      // 5) Short viewport: tabbing through the host controls never lands under another element.
      await host.setViewportSize({ width: 640, height: 360 });
      await host.locator('[data-live-heading]').focus();
      const walk = browserName !== 'webkit';
      const reached = new Set<string>();
      for (let i = 0; walk && i < 40; i += 1) {
        await host.keyboard.press('Tab');
        const info = await host.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const r = el.getBoundingClientRect();
          const x = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
          const y = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1);
          const top = document.elementFromPoint(x, y);
          const visible = r.bottom > 0 && r.top < window.innerHeight;
          const clear = !!top && (el === top || el.contains(top) || top.contains(el));
          return { name: (el.textContent ?? '').trim().slice(0, 30), visible, clear };
        });
        if (!info) continue;
        expect(info, `focused "${info.name}"`).toMatchObject({ visible: true, clear: true });
        reached.add(info.name);
      }
      const barPosition = await host
        .getByRole('region', { name: 'Host controls' })
        .locator('xpath=..')
        .evaluate((el) => getComputedStyle(el).position);
      expect(barPosition).toBe('static');
      for (const label of walk ? ['Close round', '+15 s', 'Pause', 'Skip question', 'More'] : []) {
        expect(
          [...reached].some((n) => n.startsWith(label)),
          `reached ${label} (saw: ${[...reached].join(' | ')})`,
        ).toBe(true);
      }

      // 6) Persistent announcements and titles follow the phase.
      await host.setViewportSize({ width: 1440, height: 900 });
      await host.getByRole('button', { name: 'Close round' }).click();
      await expect(mia).toHaveTitle('Results - FunFriday');
      await expect(mia.getByRole('status').filter({ hasText: 'Results are in' })).toHaveCount(1);
      for (const a of [admin, ...members]) await a.context.close();
    },
  );
});
