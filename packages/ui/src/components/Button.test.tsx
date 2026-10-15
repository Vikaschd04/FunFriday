import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { LinkButton } from './LinkButton.js';

describe('Button', () => {
  it('renders a native button that activates with click, Enter and Space', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('uses aria-disabled (never disabled), ignores clicks and keeps focus', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Next
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Next' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('does not submit a form while inert', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => {
      e.preventDefault();
    });
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" disabled>
          Go
        </Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('loading is busy, inert, shows the loading label and keeps focus', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button onClick={onClick}>Save draft</Button>);
    const button = screen.getByRole('button');
    button.focus();
    rerender(
      <Button loading loadingLabel="Saving..." onClick={onClick}>
        Save draft
      </Button>,
    );
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleName('Saving...');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies variants and meets the 44px min-height class', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('bg-ff-coral-700');
    expect(button.className).toContain('min-h-11');
  });
});

describe('LinkButton', () => {
  it('renders an anchor with the button styles', () => {
    render(
      <LinkButton href="/builder" variant="secondary">
        Plan with this activity
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Plan with this activity' });
    expect(link).toHaveAttribute('href', '/builder');
    expect(link.className).toContain('border-ff-border-strong');
  });

  it('external links open safely and say so', () => {
    render(
      <LinkButton href="https://example.com" external>
        Docs
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Docs (opens in a new tab)' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('supports a render prop for framework link components', () => {
    render(
      <LinkButton href="/x" render={(props) => <a data-framework="next" {...props} />}>
        Go
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('data-framework', 'next');
    expect(link.className).toContain('bg-ff-violet-700');
  });
});
