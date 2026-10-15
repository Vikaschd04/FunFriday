---
paths:
  - "apps/web/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
---
# Frontend Rules

- React/Next.js strict TS; accessible semantic HTML; keyboard/focus states by default.
- User interactions must be wired to working data/actions; no nonfunctional buttons.
- Consume validated server contracts; never compute trusted scores/timers client-side.
- Use semantic design tokens, stable components, responsive layouts and reduced motion.
- Any view touched must cover default/loading/error/empty/offline and mobile behavior.
- Test visual regressions for key viewport sizes and relevant accessibility behavior.
