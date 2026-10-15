import type { ActivityCategory } from '@funfriday/contracts';

/** Decorative motifs: rings, dots, squiggles. Always aria-hidden. */
const ink = 'var(--ff-ink)';

export const CATEGORY_PANEL: Record<ActivityCategory, string> = {
  icebreaker: 'bg-ff-violet-50',
  check_in: 'bg-ff-mint-50',
  quiz: 'bg-ff-sun-50',
  guessing: 'bg-ff-coral-50',
  creative: 'bg-ff-violet-50',
};

/** Colour for the agenda node of each category (decorative; number is always shown). */
export const CATEGORY_DOT: Record<ActivityCategory, string> = {
  icebreaker: 'bg-ff-violet-600',
  check_in: 'bg-ff-mint-500',
  quiz: 'bg-ff-sun-400',
  guessing: 'bg-ff-coral-500',
  creative: 'bg-ff-violet-600',
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 240 120" aria-hidden="true" focusable="false" className="h-full w-full">
      {children}
    </svg>
  );
}

export function CategoryMotif({ category }: { category: ActivityCategory }) {
  switch (category) {
    case 'icebreaker':
      return (
        <Frame>
          <circle
            cx="100"
            cy="60"
            r="34"
            fill="none"
            stroke="var(--ff-violet-600)"
            strokeWidth="8"
          />
          <circle cx="140" cy="60" r="34" fill="none" stroke="var(--ff-mint-500)" strokeWidth="8" />
          <circle cx="100" cy="60" r="6" fill="var(--ff-coral-500)" />
          <circle cx="140" cy="60" r="6" fill="var(--ff-sun-400)" />
        </Frame>
      );
    case 'check_in':
      return (
        <Frame>
          <path
            d="M70 44 Q120 78 170 44"
            fill="none"
            stroke={ink}
            strokeWidth="4"
            strokeLinecap="round"
          />
          {[
            [60, 92, 7, 'var(--ff-violet-600)'],
            [90, 96, 10, 'var(--ff-mint-500)'],
            [120, 90, 6, 'var(--ff-coral-500)'],
            [150, 96, 9, 'var(--ff-sun-400)'],
            [180, 92, 7, 'var(--ff-violet-600)'],
          ].map(([cx, cy, r, fill]) => (
            <circle
              key={String(cx)}
              cx={cx as number}
              cy={cy as number}
              r={r as number}
              fill={fill as string}
            />
          ))}
        </Frame>
      );
    case 'quiz':
      return (
        <Frame>
          <rect
            x="70"
            y="52"
            width="56"
            height="44"
            rx="10"
            fill="var(--ff-violet-600)"
            opacity="0.35"
          />
          <rect
            x="84"
            y="40"
            width="56"
            height="44"
            rx="10"
            fill="var(--ff-mint-500)"
            opacity="0.6"
          />
          <rect
            x="104"
            y="20"
            width="60"
            height="50"
            rx="12"
            fill="var(--ff-coral-500)"
            transform="rotate(-8 134 45)"
          />
          <path
            d="M124 36 q0 -8 10 -8 q10 0 10 8 q0 6 -8 9 v4"
            fill="none"
            stroke="var(--ff-sun-50)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="136" cy="58" r="3" fill="var(--ff-sun-50)" />
        </Frame>
      );
    case 'guessing':
      return (
        <Frame>
          <circle cx="90" cy="60" r="30" fill="none" stroke="var(--ff-coral-500)" strokeWidth="8" />
          <g fill={ink} opacity="0.7">
            <circle cx="132" cy="70" r="3" />
            <circle cx="148" cy="62" r="3.5" />
            <circle cx="164" cy="54" r="4" />
          </g>
          <circle
            cx="182"
            cy="46"
            r="9"
            fill="none"
            stroke={ink}
            strokeWidth="3"
            strokeDasharray="4 4"
          />
          <circle cx="90" cy="60" r="6" fill="var(--ff-violet-600)" />
        </Frame>
      );
    case 'creative':
      return (
        <Frame>
          <path
            d="M30 80 q22 -40 44 0 t44 0 t44 0 t44 0"
            fill="none"
            stroke="var(--ff-violet-600)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path d="M80 36 l22 -26 l22 26 z" fill="var(--ff-sun-400)" transform="translate(0 6)" />
          <rect
            x="150"
            y="26"
            width="30"
            height="30"
            rx="6"
            fill="var(--ff-coral-500)"
            transform="rotate(14 165 41)"
          />
          <circle cx="60" cy="30" r="6" fill="var(--ff-mint-500)" />
        </Frame>
      );
  }
}

/** Sketch & Guess: a pencil stroke ending in a speech bubble. Distinct from the Creative category motif. */
export function SketchMotif() {
  return (
    <Frame>
      <path
        d="M40 86 q24 -50 50 -14 t48 -8"
        fill="none"
        stroke="var(--ff-violet-600)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <g transform="rotate(-35 150 70)">
        <rect x="132" y="62" width="52" height="14" rx="3" fill="var(--ff-sun-400)" />
        <path d="M184 62 l16 7 l-16 7 z" fill="var(--ff-coral-500)" />
        <rect x="124" y="62" width="10" height="14" rx="3" fill="var(--ff-mint-500)" />
      </g>
      <path
        d="M168 14 h40 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-22 l-12 10 v-10 h-6 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z"
        fill="var(--ff-surface)"
        stroke={ink}
        strokeWidth="3"
      />
      <circle cx="176" cy="33" r="3" fill={ink} />
      <circle cx="188" cy="33" r="3" fill={ink} />
      <circle cx="200" cy="33" r="3" fill={ink} />
    </Frame>
  );
}

/** Motif per activity: by slug where categories collide, otherwise by category. */
export function ActivityMotif({ slug, category }: { slug: string; category: ActivityCategory }) {
  if (slug === 'sketch-and-guess') return <SketchMotif />;
  return <CategoryMotif category={category} />;
}

/** Warm rings + sun squiggle for empty states. */
export function EmptyMotif() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className="size-28">
      <circle cx="48" cy="58" r="26" fill="none" stroke="var(--ff-violet-600)" strokeWidth="8" />
      <circle
        cx="72"
        cy="58"
        r="26"
        fill="none"
        stroke="var(--ff-mint-500)"
        strokeWidth="8"
        opacity="0.9"
      />
      <circle cx="60" cy="58" r="5" fill="var(--ff-coral-500)" />
      <path
        d="M30 100 q8 -12 16 0 t16 0 t16 0"
        fill="none"
        stroke="var(--ff-sun-400)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A ring with a dot outside it: "lost" motif for 404. */
export function LostDotMotif() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className="size-28">
      <circle cx="52" cy="62" r="30" fill="none" stroke="var(--ff-violet-600)" strokeWidth="8" />
      <circle cx="102" cy="26" r="8" fill="var(--ff-coral-500)" />
      <path
        d="M62 42 q12 -14 24 -10"
        fill="none"
        stroke="var(--ff-border-strong)"
        strokeWidth="3"
        strokeDasharray="3 6"
        strokeLinecap="round"
      />
    </svg>
  );
}
