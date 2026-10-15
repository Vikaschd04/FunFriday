import { act, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { Dialog } from './Dialog.js';
import { FilterChips } from './FilterChips.js';
import { LiveRegionProvider, useAnnounce } from './LiveRegion.js';
import { ReorderList } from './ReorderList.js';
import { SkipLink } from './SkipLink.js';
import { Stepper } from './Stepper.js';

function ChipsHarness() {
  const [pressed, setPressed] = useState<string[]>([]);
  const toggle = (id: string) => {
    setPressed((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  return (
    <FilterChips
      label="Filter by category"
      onToggle={toggle}
      chips={[
        { id: 'quiz', label: 'Quiz', pressed: pressed.includes('quiz'), count: 4 },
        { id: 'draw', label: 'Drawing', pressed: pressed.includes('draw') },
      ]}
    />
  );
}

describe('FilterChips', () => {
  it('is a labelled group of toggle buttons using aria-pressed (keyboard and mouse)', async () => {
    const user = userEvent.setup();
    render(<ChipsHarness />);
    const group = screen.getByRole('group', { name: 'Filter by category' });
    const quiz = within(group).getByRole('button', { name: /Quiz/ });
    expect(quiz).toHaveAttribute('aria-pressed', 'false');
    await user.click(quiz);
    expect(quiz).toHaveAttribute('aria-pressed', 'true');
    await user.click(quiz);
    expect(quiz).toHaveAttribute('aria-pressed', 'false');
    await user.tab();
    const draw = within(group).getByRole('button', { name: 'Drawing' });
    expect(draw).toHaveFocus();
    await user.keyboard(' ');
    expect(draw).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Enter}');
    expect(draw).toHaveAttribute('aria-pressed', 'false');
  });

  it('pressed chips show a check icon in addition to the border colour', async () => {
    const user = userEvent.setup();
    render(<ChipsHarness />);
    const quiz = screen.getByRole('button', { name: /Quiz/ });
    expect(quiz.querySelector('svg')).toBeNull();
    await user.click(quiz);
    expect(quiz.querySelector('svg')).not.toBeNull();
  });
});

const steps = [
  { id: 'basics', label: 'Basics' },
  { id: 'people', label: 'Participants' },
  { id: 'acts', label: 'Activities', error: true },
  { id: 'review', label: 'Review' },
];

describe('Stepper', () => {
  it('marks only the current step with aria-current="step" and lists steps in an ordered list', () => {
    render(<Stepper steps={steps} current="people" completed={['basics']} />);
    const nav = screen.getByRole('navigation', { name: 'Event steps' });
    const items = within(nav).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.filter((i) => i.getAttribute('aria-current') === 'step')).toHaveLength(1);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(within(nav).getByText('needs attention')).toBeInTheDocument();
    expect(within(nav).getByText('Step 2 of 4 - Participants')).toBeInTheDocument();
  });

  it('only completed steps are buttons and they navigate back', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Stepper steps={steps} current="people" completed={['basics']} onStepSelect={onSelect} />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith('basics');
  });

  it('announces step changes politely but not on first render', () => {
    const { rerender } = render(<Stepper steps={steps} current="basics" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');
    rerender(<Stepper steps={steps} current="people" completed={['basics']} />);
    expect(status).toHaveTextContent('Step 2 of 4: Participants');
  });
});

function ReorderHarness({ onRemove }: { onRemove?: (id: string) => void }) {
  const [items, setItems] = useState([
    { id: 'a', label: 'Icebreaker' },
    { id: 'b', label: 'Trivia Rush' },
    { id: 'c', label: 'Doodle Relay' },
  ]);
  const onMove = (id: string, to: number) => {
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === id);
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  };
  return <ReorderList aria-label="Playlist" items={items} onMove={onMove} onRemove={onRemove} />;
}

describe('ReorderList', () => {
  it('names move buttons with item and position and disables the edges with aria-disabled', () => {
    render(<ReorderHarness />);
    expect(
      screen.getByRole('button', { name: 'Move Icebreaker up (position 1 of 3)' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('button', { name: 'Move Trivia Rush up (position 2 of 3)' }),
    ).not.toHaveAttribute('aria-disabled');
    expect(
      screen.getByRole('button', { name: 'Move Doodle Relay down (position 3 of 3)' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('moves with the keyboard, announces, and keeps focus on the same button', async () => {
    const user = userEvent.setup();
    render(<ReorderHarness />);
    const up = screen.getByRole('button', { name: 'Move Trivia Rush up (position 2 of 3)' });
    up.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Trivia Rush moved to position 1 of 3.');
    const rows = within(screen.getByRole('list', { name: 'Playlist' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Trivia Rush');
    const same = screen.getByRole('button', { name: 'Move Trivia Rush up (position 1 of 3)' });
    expect(same).toHaveFocus();
    expect(same).toHaveAttribute('aria-disabled', 'true');
  });

  it('moving down announces the new position and edge buttons are no-ops', async () => {
    const user = userEvent.setup();
    render(<ReorderHarness />);
    await user.click(
      screen.getByRole('button', { name: 'Move Icebreaker down (position 1 of 3)' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Icebreaker moved to position 2 of 3.');
    await user.click(
      screen.getByRole('button', { name: 'Move Doodle Relay down (position 3 of 3)' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Icebreaker moved to position 2 of 3.');
  });

  it('remove calls back', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<ReorderHarness onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'Remove Trivia Rush' }));
    expect(onRemove).toHaveBeenCalledWith('b');
  });
});

function DialogHarness({ onConfirm }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        onClick={() => {
          setOpen(true);
        }}
      >
        Delete draft
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Delete this draft?"
        description="This only removes it from this device."
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm?.();
                setOpen(false);
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}

describe('Dialog', () => {
  it('opens as a labelled modal dialog with focus on the safe action', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete draft' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this draft?' });
    expect(dialog).toHaveAccessibleDescription('This only removes it from this device.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Delete draft' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(trigger).toHaveFocus();
  });

  it('closes via Cancel and via a confirm action, returning focus both times', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} />);
    const trigger = screen.getByRole('button', { name: 'Delete draft' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
});

describe('SkipLink', () => {
  it('is a link to #main that moves focus to the target', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink />
        <main id="main">Content</main>
      </>,
    );
    await user.tab();
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute('href', '#main');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });
});

function SaveHarness() {
  const announce = useAnnounce();
  return (
    <>
      <button
        onClick={() => {
          announce('Draft saved');
        }}
      >
        Save
      </button>
      <button
        onClick={() => {
          announce('Could not save', { tone: 'danger' });
        }}
      >
        Fail
      </button>
    </>
  );
}

describe('LiveRegionProvider', () => {
  it('announces in one persistent polite region and errors in an alert region', async () => {
    const user = userEvent.setup();
    render(
      <LiveRegionProvider>
        <SaveHarness />
      </LiveRegionProvider>,
    );
    const status = screen.getByRole('status');
    const alert = screen.getByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(status).toHaveTextContent('Draft saved');
    expect(alert).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Fail' }));
    expect(alert).toHaveTextContent('Could not save');
    // The visual toast is hidden from assistive tech (no double announcement).
    expect(document.querySelector('.ff-toast')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('repeated identical messages re-announce (text changes) and the toast auto-dismisses', () => {
    vi.useFakeTimers();
    try {
      render(
        <LiveRegionProvider>
          <SaveHarness />
        </LiveRegionProvider>,
      );
      const save = screen.getByRole('button', { name: 'Save' });
      act(() => {
        save.click();
      });
      const first = screen.getByRole('status').textContent;
      act(() => {
        save.click();
      });
      expect(screen.getByRole('status').textContent).not.toBe(first);
      expect(document.querySelector('.ff-toast')).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(5100);
      });
      expect(document.querySelector('.ff-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('useAnnounce throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<SaveHarness />)).toThrow(/LiveRegionProvider/);
    spy.mockRestore();
  });
});
