import {
  ArrowLeftRight,
  CircleHelp,
  MessageSquareQuote,
  PencilLine,
  Smile,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { HeroArt, LogoMark } from '@/components/brand-art';
import { StatusPanel } from '@/components/status-panel';

const activities: Array<{ name: string; blurb: string; icon: LucideIcon }> = [
  {
    name: 'This or That',
    blurb: 'Quick, low-stakes either/or picks that reveal shared tastes.',
    icon: ArrowLeftRight,
  },
  {
    name: 'Emoji Check-In',
    blurb: 'Share the vibe you are bringing today, or simply pass.',
    icon: Smile,
  },
  { name: 'Trivia Rush', blurb: 'Fast team trivia with answers revealed together.', icon: Zap },
  {
    name: 'Who Am I?',
    blurb: 'A friendly guessing game built around playful clues.',
    icon: CircleHelp,
  },
  {
    name: 'Caption Clash',
    blurb: 'Write a caption, then vote on the funniest as a group.',
    icon: MessageSquareQuote,
  },
  {
    name: 'Sketch & Guess',
    blurb: 'Draw and guess together, with a keyboard-friendly alternative.',
    icon: PencilLine,
  },
];

export default function HomePage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-5 sm:px-8">
        <LogoMark className="h-8 w-12" />
        <span className="font-heading text-xl font-extrabold tracking-tight text-ff-ink">
          FunFriday
        </span>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        <section
          aria-labelledby="hero-heading"
          className="grid items-center gap-10 py-8 md:grid-cols-[1.15fr_0.85fr] md:py-14"
        >
          <div className="ff-enter">
            <p className="inline-flex items-center rounded-full bg-ff-violet-50 px-3 py-1 text-sm font-semibold text-ff-ink">
              Foundation build
            </p>
            <h1
              id="hero-heading"
              className="mt-5 font-heading font-extrabold tracking-tight text-ff-ink"
            >
              <span className="block text-4xl sm:text-5xl lg:text-6xl">FunFriday</span>{' '}
              <span className="mt-3 block text-2xl leading-tight sm:text-3xl lg:text-4xl">
                Good teams work together. Great teams connect.
              </span>
            </h1>
            <p className="mt-5 text-xl font-semibold text-ff-violet-800">
              Connect Beyond Work. Play Together. Grow Together.
            </p>
            <p className="mt-4 max-w-xl text-lg text-ff-muted">
              Short, inclusive games that help distributed and in-person teams relax, laugh and get
              to know each other. Every activity will have a pass option, no camera required.
            </p>
          </div>
          <div
            className="ff-enter mx-auto w-full max-w-sm md:max-w-none"
            style={{ '--ff-i': 2 } as React.CSSProperties}
          >
            <HeroArt className="h-auto w-full" />
          </div>
        </section>

        <div className="ff-enter" style={{ '--ff-i': 3 } as React.CSSProperties}>
          <StatusPanel />
          <noscript>
            <p className="mt-3 text-ff-muted">System status needs JavaScript to contact the API.</p>
          </noscript>
        </div>

        <section aria-labelledby="activities-heading" className="mt-16">
          <h2
            id="activities-heading"
            className="font-heading text-2xl font-bold text-ff-ink sm:text-3xl"
          >
            Six launch activities
          </h2>
          <p className="mt-2 max-w-2xl text-ff-muted">
            A preview of what is being built. None of these are playable yet.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map(({ name, blurb, icon: Icon }, i) => (
              <li
                key={name}
                className="ff-enter rounded-ff-card border border-ff-border bg-ff-surface p-5"
                style={{ '--ff-i': i + 4 } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-ff-violet-50 text-ff-violet-800">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <span className="rounded-full border border-ff-border-strong px-2.5 py-0.5 text-xs font-semibold text-ff-ink">
                    In development
                  </span>
                </div>
                <h3 className="mt-4 font-heading text-lg font-bold text-ff-ink">{name}</h3>
                <p className="mt-1 text-ff-muted">{blurb}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-ff-border bg-ff-surface">
        <p className="mx-auto max-w-6xl px-5 py-6 text-sm text-ff-muted sm:px-8">
          Foundation build - fictional preview, no real data.
        </p>
      </footer>
    </>
  );
}
