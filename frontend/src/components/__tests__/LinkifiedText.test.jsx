import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LinkifiedText from '../LinkifiedText';
import { splitLinks } from '../../utlis/linkify';

describe('LinkifiedText', () => {
  it('makes http(s) links clickable in a new tab', () => {
    render(<LinkifiedText text="notes at https://example.com/os.pdf today" />);
    const link = screen.getByRole('link', { name: 'https://example.com/os.pdf' });
    expect(link).toHaveAttribute('href', 'https://example.com/os.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links www. addresses over https', () => {
    render(<LinkifiedText text="try www.mnnit.ac.in" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.mnnit.ac.in');
  });

  it('leaves sentence punctuation and wrapping brackets out of the link', () => {
    expect(splitLinks('See https://x.com/a.')).toEqual([{ text: 'See ' }, { text: 'https://x.com/a', href: 'https://x.com/a' }, { text: '.' }]);
    expect(splitLinks('(see https://x.com/a)')[1]).toEqual({ text: 'https://x.com/a', href: 'https://x.com/a' });
    expect(splitLinks('https://en.wikipedia.org/wiki/Foo_(bar)')[0].href).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(splitLinks('go to https://x.com, then')[1].text).toBe('https://x.com');
  });

  it('never links other schemes', () => {
    render(<LinkifiedText text="javascript:alert(1) and ftp://x.com" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps plain text and multiple links in order', () => {
    const { container } = render(<LinkifiedText text="a https://one.com b https://two.com c" />);
    expect(container.textContent).toBe('a https://one.com b https://two.com c');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('highlights a search term, including inside a link', () => {
    const { container } = render(<LinkifiedText text="os notes https://os.example.com" highlightQuery="os" />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(2);
    expect(screen.getByRole('link').querySelector('mark')).not.toBeNull();
  });

  it('does not treat regex characters in the search term specially', () => {
    expect(() => render(<LinkifiedText text="what (is) this?" highlightQuery="(is" />)).not.toThrow();
  });

  it("clicking a link doesn't reach the surrounding message/card handler", () => {
    const outer = vi.fn();
    render(<div onClick={outer}><LinkifiedText text="https://x.com" /></div>);
    fireEvent.click(screen.getByRole('link'));
    expect(outer).not.toHaveBeenCalled();
  });
});
