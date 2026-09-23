import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import SubjectPicker from '../SubjectPicker';

const SUBJECTS = [
  { name: 'Operating Systems', count: 12 },
  { name: 'Computer Networks', count: 5 },
  { name: 'Compiler Design', count: 2 },
];

const Harness = ({ onChange = () => {}, subjects = SUBJECTS, disabled = false, initial = '' }) => {
  const [value, setValue] = useState(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onChange('SUBMITTED'); }}>
      <SubjectPicker
        id="subject"
        value={value}
        onChange={(v) => { setValue(v); onChange(v); }}
        subjects={subjects}
        maxLength={80}
        disabled={disabled}
        disabledHint="Choose a branch and semester first"
      />
    </form>
  );
};

// Option text without the decorative icon glyphs ("add", "check").
const options = () =>
  screen.queryAllByRole('option').map((o) =>
    Array.from(o.childNodes)
      .filter((n) => n.getAttribute?.('aria-hidden') !== 'true')
      .map((n) => n.textContent)
      .join('')
  );

describe('SubjectPicker', () => {
  it('lists existing subjects with counts when focused', () => {
    render(<Harness />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(options()).toEqual(['Operating Systems12', 'Computer Networks5', 'Compiler Design2']);
  });

  it('filters as you type and picks an existing subject on click', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'comp' } });
    expect(options()).toEqual(['Computer Networks5', 'Compiler Design2', 'Add “comp” as a new subject']);

    fireEvent.mouseDown(screen.getByText('Compiler Design'));
    expect(onChange).toHaveBeenLastCalledWith('Compiler Design');
    expect(input).toHaveValue('Compiler Design');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('offers to add a new subject when nothing matches', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '  Machine   Learning ' } });
    expect(options()).toEqual(['Add “Machine Learning” as a new subject']);

    fireEvent.mouseDown(screen.getByText('Add “Machine Learning” as a new subject'));
    expect(onChange).toHaveBeenLastCalledWith('Machine Learning');
  });

  it("doesn't offer to add a subject that already exists in another case", () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'operating systems' } });
    expect(options()).toEqual(['Operating Systems12']);
  });

  it('arrow keys + Enter pick an option without submitting the form', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('Computer Networks');
    expect(onChange).not.toHaveBeenCalledWith('SUBMITTED');
  });

  it('explains when there are no subjects yet', () => {
    render(<Harness subjects={[]} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByText(/No subjects yet/)).toBeInTheDocument();
  });

  describe('as a search filter (no create)', () => {
    const FilterHarness = ({ onSelect, onDismiss }) => {
      const [text, setText] = useState('');
      return (
        <SubjectPicker
          value={text}
          onChange={setText}
          onSelect={(name) => { setText(name); onSelect(name); }}
          onDismiss={onDismiss}
          subjects={SUBJECTS}
          allowCreate={false}
          floating
          placeholder="Search subjects…"
          emptyText="No subjects match"
        />
      );
    };

    it('searches all subjects as you type and never offers to add one', () => {
      render(<FilterHarness onSelect={vi.fn()} />);
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'net' } });
      expect(options()).toEqual(['Computer Networks5']);
      fireEvent.change(input, { target: { value: 'quantum' } });
      expect(options()).toEqual([]);
      expect(screen.getByText('No subjects match')).toBeInTheDocument();
    });

    it('reports the picked subject separately from typing, and closing without picking', () => {
      const onSelect = vi.fn();
      const onDismiss = vi.fn();
      render(<FilterHarness onSelect={onSelect} onDismiss={onDismiss} />);
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'oper' } });
      expect(onSelect).not.toHaveBeenCalled();
      fireEvent.mouseDown(screen.getByText('Operating Systems'));
      expect(onSelect).toHaveBeenCalledWith('Operating Systems');
      fireEvent.blur(input);
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  it('clears the subject', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="Operating Systems" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear subject' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('is disabled until a branch and semester are chosen', () => {
    render(<Harness disabled />);
    const input = screen.getByRole('combobox');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Choose a branch and semester first');
  });
});
