import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { vi, describe, expect, it } from 'vitest';
import { Badge, InDevelopmentBadge } from './Badge.js';
import { Card } from './Card.js';
import { RuntimeMeter, runtimeSummary } from './RuntimeMeter.js';
import { Skeleton } from './Skeleton.js';
import { DeniedState, EmptyState, ErrorState, Notice } from './states.js';
import { LinkButton } from './LinkButton.js';

describe('Badge', () => {
  it.each(['success', 'warning', 'danger', 'info'] as const)(
    '%s tone always has an icon plus text',
    (tone) => {
      render(<Badge tone={tone}>Label</Badge>);
      const badge = screen.getByText('Label').parentElement as HTMLElement;
      expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(badge).toHaveTextContent('Label');
      expect(badge).not.toHaveAttribute('role');
    },
  );

  it('In development badge shows text with an icon on a neutral pill', () => {
    render(<InDevelopmentBadge />);
    const text = screen.getByText('In development');
    expect(text.parentElement?.querySelector('svg')).not.toBeNull();
  });
});

describe('Card', () => {
  it('renders the requested element with header, body and footer', () => {
    render(
      <Card
        as="article"
        header={<h3>Trivia Rush</h3>}
        footer={<LinkButton href="/b">Plan with this activity</LinkButton>}
      >
        Body copy
      </Card>,
    );
    const card = screen.getByRole('article');
    expect(card).toHaveTextContent('Body copy');
    expect(screen.getByRole('heading', { name: 'Trivia Rush' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan with this activity' })).toBeInTheDocument();
  });

  it('interactive adds the lift class', () => {
    render(
      <Card interactive data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain('ff-lift');
  });
});

describe('Skeleton', () => {
  it('is busy, labelled for assistive tech, and hides the shapes', () => {
    const { container } = render(<Skeleton variant="card" count={3} label="Loading activities" />);
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Loading activities');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});

describe('EmptyState', () => {
  it('renders heading at the requested level and real actions', () => {
    render(
      <EmptyState
        title="No drafts yet"
        headingLevel={3}
        body="Plan your first event."
        illustration={<svg />}
        primaryAction={<LinkButton href="/builder">Start planning</LinkButton>}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'No drafts yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start planning' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('calls retry, keeps focus on the Retry button while busy, and uses status by default', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <ErrorState
        title="Could not load activities"
        body="Check your connection."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try again' });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    retry.focus();
    rerender(<ErrorState title="Could not load activities" onRetry={onRetry} retrying />);
    const busy = screen.getByRole('button', { name: 'Retrying...' });
    expect(busy).toHaveFocus();
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses role=alert when the error follows a user action', () => {
    render(<ErrorState title="Save failed" announce="alert" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
  });
});

describe('DeniedState', () => {
  it('is a status with a lock icon, text and an action', () => {
    render(
      <DeniedState
        title="You do not have access"
        body="Ask an organiser."
        action={<LinkButton href="/">Back home</LinkButton>}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.querySelector('svg')).not.toBeNull();
    expect(status).toHaveTextContent('You do not have access');
    expect(screen.getByRole('link', { name: 'Back home' })).toBeInTheDocument();
  });
});

describe('Notice', () => {
  it('static notices have no live role; announce adds one', () => {
    const { rerender } = render(
      <Notice tone="info" title="Preview workspace">
        Accounts arrive later.
      </Notice>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(
      <Notice tone="info" announce>
        Dynamic
      </Notice>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(
      <Notice tone="danger" announce>
        Broken
      </Notice>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('warning shows an icon and the visible "Heads up:" prefix', () => {
    const { container } = render(<Notice tone="warning">Over time</Notice>);
    expect(screen.getByText(/Heads up:/)).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('RuntimeMeter', () => {
  const segments = [
    { slug: 'a', label: 'Icebreaker', minutes: 20 },
    { slug: 'b', label: 'Trivia', minutes: 22 },
  ];

  it('under budget: text equivalent as label and visible text', () => {
    render(<RuntimeMeter eventMinutes={60} activityMinutes={42} segments={segments} />);
    const text = '42 of 60 minutes planned, 18 minutes of buffer';
    expect(screen.getByRole('img', { name: text })).toBeInTheDocument();
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it('over budget: not colour only (icon + text + hatch)', () => {
    const { container } = render(
      <RuntimeMeter
        eventMinutes={60}
        activityMinutes={70}
        segments={[
          { slug: 'a', label: 'A', minutes: 40 },
          { slug: 'b', label: 'B', minutes: 30 },
        ]}
      />,
    );
    const text = '70 of 60 minutes planned, 10 minutes over';
    expect(screen.getByRole('img', { name: text })).toBeInTheDocument();
    expect(screen.getByText(text).previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    expect(container.querySelector('.ff-hatch-danger')).not.toBeNull();
  });

  it('mentions a buffer shortfall and handles singular minutes', () => {
    expect(runtimeSummary(60, 56, 10)).toBe(
      '56 of 60 minutes planned, 4 minutes of buffer, less than the 10-minute buffer',
    );
    expect(runtimeSummary(60, 61)).toBe('61 of 60 minutes planned, 1 minute over');
  });

  it('announces changes politely, debounced, not on first render', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <RuntimeMeter eventMinutes={60} activityMinutes={42} segments={segments} />,
      );
      const live = screen.getAllByRole('status')[0] as HTMLElement;
      expect(live).toHaveTextContent('');
      rerender(<RuntimeMeter eventMinutes={60} activityMinutes={70} segments={segments} />);
      expect(live).toHaveTextContent('');
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(live).toHaveTextContent('70 of 60 minutes planned, 10 minutes over');
    } finally {
      vi.useRealTimers();
    }
  });
});
