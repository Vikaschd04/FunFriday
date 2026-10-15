/** Original decorative motif: interlocking loops, connected dots, confetti. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true" focusable="false" className={className}>
      <circle cx="17" cy="16" r="10" fill="none" stroke="var(--ff-violet-600)" strokeWidth="5" />
      <circle
        cx="31"
        cy="16"
        r="10"
        fill="none"
        stroke="var(--ff-mint-500)"
        strokeWidth="5"
        opacity="0.9"
      />
      <circle cx="24" cy="16" r="2.5" fill="var(--ff-coral-500)" />
    </svg>
  );
}

export function HeroArt({ className = '' }: { className?: string }) {
  const dots: Array<[number, number, string]> = [
    [70, 90, 'var(--ff-violet-600)'],
    [190, 60, 'var(--ff-mint-500)'],
    [300, 130, 'var(--ff-coral-500)'],
    [150, 210, 'var(--ff-sun-400)'],
    [270, 260, 'var(--ff-violet-600)'],
    [60, 270, 'var(--ff-mint-500)'],
  ];
  return (
    <svg viewBox="0 0 360 340" aria-hidden="true" focusable="false" className={className}>
      <g fill="none" strokeLinecap="round">
        <circle
          cx="140"
          cy="150"
          r="82"
          stroke="var(--ff-violet-600)"
          strokeWidth="14"
          opacity="0.9"
        />
        <circle
          cx="220"
          cy="150"
          r="82"
          stroke="var(--ff-mint-500)"
          strokeWidth="14"
          opacity="0.85"
        />
        <circle
          cx="180"
          cy="215"
          r="82"
          stroke="var(--ff-coral-500)"
          strokeWidth="14"
          opacity="0.75"
        />
      </g>
      <g stroke="var(--ff-border-strong)" strokeWidth="1.5" strokeDasharray="4 6" fill="none">
        <path d="M70 90 L190 60 L300 130 L270 260 L150 210 L60 270 L70 90 Z" />
      </g>
      {dots.map(([x, y, c]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill={c} />
      ))}
      <rect
        x="305"
        y="40"
        width="16"
        height="16"
        rx="4"
        fill="var(--ff-sun-400)"
        transform="rotate(20 313 48)"
      />
      <rect
        x="30"
        y="170"
        width="14"
        height="14"
        rx="3"
        fill="var(--ff-coral-500)"
        transform="rotate(-18 37 177)"
      />
      <path d="M320 220 l10 18 l-20 0 z" fill="var(--ff-violet-600)" />
      <path
        d="M110 20 q10 -14 20 0 t20 0"
        fill="none"
        stroke="var(--ff-sun-400)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
