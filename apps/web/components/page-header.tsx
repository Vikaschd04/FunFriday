import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      <h1
        tabIndex={-1}
        className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink md:text-[40px] md:leading-[46px]"
      >
        {title}
      </h1>
      {description && <p className="text-ff-muted">{description}</p>}
      {children}
    </header>
  );
}
