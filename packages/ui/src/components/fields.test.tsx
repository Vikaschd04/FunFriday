import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField, SearchField, Select, TextField, Textarea } from './fields.js';

describe('TextField', () => {
  it('links label, hint and error through aria-describedby with aria-invalid', () => {
    render(
      <TextField label="Event title" hint="Shown to everyone" error="Enter a title" required />,
    );
    const input = screen.getByRole('textbox', { name: /Event title/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Shown to everyone Enter a title');
  });

  it('has no invalid state or error description when valid', () => {
    render(<TextField label="Event title" hint="Shown to everyone" />);
    const input = screen.getByRole('textbox', { name: 'Event title' });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('Shown to everyone');
  });

  it('keeps caller aria-describedby', () => {
    render(<TextField label="Name" aria-describedby="extra" error="Bad" />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input.getAttribute('aria-describedby')).toMatch(/^extra .*-error$/);
  });
});

describe('Textarea', () => {
  it('shows a character counter wired into the description', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Notes" maxLength={20} />);
    const box = screen.getByRole('textbox', { name: 'Notes' });
    expect(box).toHaveAccessibleDescription('0 / 20 characters');
    await user.type(box, 'hello');
    expect(box).toHaveAccessibleDescription('5 / 20 characters');
  });
});

describe('Select', () => {
  it('is a native select with a placeholder and error wiring', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        label="Time zone"
        placeholder="Choose"
        error="Pick one"
        onChange={onChange}
        options={[
          { value: 'UTC', label: 'UTC' },
          { value: 'Asia/Kolkata', label: 'India' },
        ]}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Time zone' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Pick one');
    await user.selectOptions(select, 'Asia/Kolkata');
    expect(onChange).toHaveBeenCalled();
    expect(select).toHaveValue('Asia/Kolkata');
  });
});

function NumberHarness({
  initial = 10,
  min = 2,
  max = 12,
}: {
  initial?: number | null;
  min?: number;
  max?: number;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <NumberField
      label="Group size"
      value={value}
      onValueChange={setValue}
      min={min}
      max={max}
      showStepper
      error={value === null ? 'Enter a number' : undefined}
    />
  );
}

describe('NumberField', () => {
  it('uses numeric inputmode and steps with ArrowUp/ArrowDown within bounds', async () => {
    const user = userEvent.setup();
    render(<NumberHarness initial={11} />);
    const input = screen.getByRole('textbox', { name: 'Group size' });
    expect(input).toHaveAttribute('inputmode', 'numeric');
    input.focus();
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveValue('12');
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveValue('12');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(input).toHaveValue('10');
  });

  it('typing reports numbers, and null when empty', async () => {
    const user = userEvent.setup();
    render(<NumberHarness initial={5} />);
    const input = screen.getByRole('textbox', { name: 'Group size' });
    await user.clear(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.type(input, '8');
    expect(input).toHaveValue('8');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('stepper buttons work and the one at the limit is aria-disabled', async () => {
    const user = userEvent.setup();
    render(<NumberHarness initial={11} />);
    const inc = screen.getByRole('button', { name: 'Increase Group size' });
    await user.click(inc);
    expect(screen.getByRole('textbox')).toHaveValue('12');
    expect(inc).toHaveAttribute('aria-disabled', 'true');
    await user.click(inc);
    expect(screen.getByRole('textbox')).toHaveValue('12');
    await user.click(screen.getByRole('button', { name: 'Decrease Group size' }));
    expect(screen.getByRole('textbox')).toHaveValue('11');
  });
});

function SearchHarness({ message }: { message?: string }) {
  const [value, setValue] = useState('');
  return (
    <SearchField
      label="Search activities"
      value={value}
      onValueChange={setValue}
      resultsMessage={message}
    />
  );
}

describe('SearchField', () => {
  it('has a hidden label, clears with Escape and with the Clear button (focus returns to input)', async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    const input = screen.getByRole('searchbox', { name: 'Search activities' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    await user.type(input, 'trivia');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('does not announce the initial summary, then announces changes after a debounce', async () => {
    const { rerender } = render(<SearchHarness message="6 activities" />);
    const status = screen.getByRole('status');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(status).toHaveTextContent('');
    rerender(<SearchHarness message="1 activity" />);
    expect(status).toHaveTextContent('');
    await waitFor(() => {
      expect(status).toHaveTextContent('1 activity');
    });
  });
});
