import { Accessibility, Camera, EyeOff, Lock, Smile, Timer, Users } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { Card } from '@funfriday/ui';
import { AppLinkButton } from '@/components/app-link-button';
import { HeroArt } from '@/components/brand-art';
import { CATEGORY_PANEL, CategoryMotif } from '@/components/motifs';
import { PublicShell } from '@/components/public-shell';

const stagger = (i: number): CSSProperties => ({ '--ff-i': i }) as CSSProperties;

function PlanPreview() {
  // A static, honest composite of the planner. Decorative: described by the figure's role=img label.
  const rows = [
    { time: '15:00', name: 'Icebreaker', min: '10 min', w: 'w-[24%]', c: 'bg-ff-violet-700' },
    { time: '15:12', name: 'Quick quiz', min: '15 min', w: 'w-[34%]', c: 'bg-ff-violet-600' },
    { time: '15:29', name: 'Creative round', min: '12 min', w: 'w-[27%]', c: 'bg-ff-violet-700' },
  ];
  return (
    <figure className="mt-10 md:mt-12">
      <div
        role="img"
        aria-label="Illustration of the FunFriday planner: an agenda with three activities, start times, and a time meter showing 37 of 45 minutes planned. The sample plan is fictional."
        className="overflow-hidden rounded-ff-card bg-ff-surface shadow-ff-lg ring-1 ring-ff-border"
      >
        <div
          aria-hidden="true"
          className="flex items-center gap-2 border-b border-ff-border bg-ff-canvas px-4 py-3"
        >
          <span className="size-3 rounded-full bg-ff-coral-500" />
          <span className="size-3 rounded-full bg-ff-sun-400" />
          <span className="size-3 rounded-full bg-ff-mint-500" />
          <span className="ml-3 rounded-full bg-ff-surface px-3 py-1 text-xs text-ff-muted ring-1 ring-ff-border">
            funfriday / plan / sample-team
          </span>
        </div>
        <div aria-hidden="true" className="grid gap-6 p-5 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <p className="font-heading text-xl font-bold text-ff-ink">Sample Team Friday</p>
            <p className="text-sm text-ff-muted">Friday, 15:00-15:45 - 20 people (sample)</p>
            <ol className="mt-5 space-y-3">
              {rows.map((row, i) => (
                <li
                  key={row.name}
                  className="flex items-center gap-3 rounded-ff-button border border-ff-border p-3"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-ff-violet-50 text-sm font-bold text-ff-violet-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold text-ff-ink">{row.name}</span>
                  <span className="text-sm whitespace-nowrap text-ff-muted">
                    <span className="hidden sm:inline">{row.time} - </span>
                    {row.min}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col justify-between gap-6">
            <div className="flex items-center gap-4 rounded-ff-card bg-ff-violet-50 p-3">
              <div className="h-14 w-24 shrink-0">
                <CategoryMotif category="icebreaker" />
              </div>
              <div>
                <p className="text-xs leading-4 font-semibold tracking-wide text-ff-violet-700 uppercase">
                  Up next
                </p>
                <p className="font-semibold text-ff-ink">Icebreaker, 15:00</p>
                <p className="text-sm text-ff-muted">Sample plan</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-ff-ink">Time planned</p>
              <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-ff-border">
                {rows.map((row) => (
                  <span
                    key={row.name}
                    className={`h-full border-r-2 border-ff-surface ${row.w} ${row.c}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-ff-ink">
                37 of 45 minutes planned, 8 minutes of buffer
              </p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-ff-muted">
        Illustration of the planner. Sample plan is fictional.
      </figcaption>
    </figure>
  );
}

const benefits: Array<{ title: string; body: string; icon: ReactNode }> = [
  {
    title: 'Short and playful',
    body: 'Sessions of 10 to 30 minutes that fit between meetings.',
    icon: <Timer aria-hidden="true" className="size-6" />,
  },
  {
    title: 'Everyone can join',
    body: 'Every personal question has a pass option. No camera required.',
    icon: <Users aria-hidden="true" className="size-6" />,
  },
  {
    title: 'Plan in minutes',
    body: 'Pick activities, then see your runtime and local times.',
    icon: <Smile aria-hidden="true" className="size-6" />,
  },
];

const steps = [
  { title: 'Set the basics', body: 'Name, time and time zone.' },
  { title: 'Choose activities', body: 'Pick from the catalog and see how long they run.' },
  { title: 'Review the agenda', body: 'See local times at a glance.' },
];

const trust: Array<{ title: string; body: string; icon: ReactNode }> = [
  {
    title: 'Accessible by design',
    body: 'Built for keyboard use, reduced motion and screen reader text, targeting WCAG 2.2 AA.',
    icon: <Accessibility aria-hidden="true" className="size-6" />,
  },
  {
    title: 'Privacy first',
    body: 'Nothing you type here leaves this device in this preview.',
    icon: <Lock aria-hidden="true" className="size-6" />,
  },
  {
    title: 'No camera required',
    body: 'Built so every activity works with the camera off.',
    icon: <Camera aria-hidden="true" className="size-6" />,
  },
  {
    title: 'No surveillance',
    body: 'We do not rank people or track individual performance or mood.',
    icon: <EyeOff aria-hidden="true" className="size-6" />,
  },
];

export default function HomePage() {
  return (
    <PublicShell>
      <section
        aria-labelledby="hero-heading"
        className="grid items-center gap-10 pt-6 pb-0 md:grid-cols-[1.1fr_0.9fr] md:pt-12 lg:pt-20"
      >
        <div className="ff-enter">
          <p className="inline-flex items-center rounded-full bg-ff-violet-50 px-3 py-1 text-sm font-semibold text-ff-ink">
            Preview build - nothing is sent or shared
          </p>
          <h1
            id="hero-heading"
            className="mt-5 font-heading text-[40px] leading-[44px] font-extrabold tracking-[-0.03em] text-ff-ink md:text-[52px] md:leading-[56px] lg:text-[64px] lg:leading-[68px]"
          >
            Good teams work together. Great teams connect.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ff-muted md:text-xl">
            Short, inclusive games that help distributed and in-person teams relax, laugh and get to
            know each other.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <AppLinkButton href="/app/events/new" size="lg" className="sm:w-auto">
              Plan a FunFriday
            </AppLinkButton>
            <AppLinkButton href="/app/library" variant="secondary" size="lg">
              Explore activities
            </AppLinkButton>
          </div>
        </div>
        <div className="ff-enter mx-auto w-full max-w-xs md:max-w-none" style={stagger(2)}>
          <HeroArt className="h-auto w-full" />
        </div>
      </section>

      <div className="ff-enter" style={stagger(3)}>
        <PlanPreview />
      </div>

      <section aria-labelledby="benefits-heading" className="mt-16 md:mt-24">
        <h2
          id="benefits-heading"
          className="font-heading text-2xl leading-8 font-bold tracking-tight text-ff-ink md:text-3xl md:leading-[38px]"
        >
          Made for real teams, not forced fun
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {benefits.map((item, i) => (
            <li key={item.title} className="ff-enter" style={stagger(i + 4)}>
              <Card as="div" className="h-full">
                <span className="grid size-11 place-items-center rounded-xl bg-ff-violet-50 text-ff-violet-800">
                  {item.icon}
                </span>
                <h3 className="font-heading text-lg font-bold text-ff-ink">{item.title}</h3>
                <p className="text-ff-muted">{item.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-heading" className="mt-16 md:mt-24">
        <h2
          id="steps-heading"
          className="font-heading text-2xl leading-8 font-bold tracking-tight text-ff-ink md:text-3xl md:leading-[38px]"
        >
          From idea to Friday in three steps
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 md:flex-col">
              <span
                aria-hidden="true"
                className="ff-tnum grid size-11 shrink-0 place-items-center rounded-full bg-ff-violet-700 text-lg font-bold text-white"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-heading text-lg font-bold text-ff-ink">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="text-ff-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="teaser-heading" className="mt-16 md:mt-24">
        <h2
          id="teaser-heading"
          className="font-heading text-2xl leading-8 font-bold tracking-tight text-ff-ink md:text-3xl md:leading-[38px]"
        >
          A taste of what&apos;s planned
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {(
            [
              ['icebreaker', 'Icebreakers'],
              ['quiz', 'Quizzes'],
              ['creative', 'Creative'],
            ] as const
          ).map(([category, label]) => (
            <li
              key={category}
              className={`flex items-center gap-4 overflow-hidden rounded-ff-card ${CATEGORY_PANEL[category]} p-3`}
            >
              <div className="h-20 w-32 shrink-0">
                <CategoryMotif category={category} />
              </div>
              <p className="font-heading text-lg font-bold text-ff-ink">{label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          <Link
            href="/app/library"
            className="inline-flex min-h-11 items-center font-semibold text-ff-violet-700 underline underline-offset-4"
          >
            Explore activities
          </Link>
        </p>
      </section>

      <section aria-labelledby="trust-heading" className="mt-16 md:mt-24">
        <h2
          id="trust-heading"
          className="font-heading text-2xl leading-8 font-bold tracking-tight text-ff-ink md:text-3xl md:leading-[38px]"
        >
          Designed to be comfortable for everyone
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {trust.map((item) => (
            <li
              key={item.title}
              className="flex gap-4 rounded-ff-card bg-ff-surface p-5 shadow-ff-sm"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ff-mint-50 text-ff-mint-700">
                {item.icon}
              </span>
              <div>
                <h3 className="font-heading text-lg font-bold text-ff-ink">{item.title}</h3>
                <p className="text-ff-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}
