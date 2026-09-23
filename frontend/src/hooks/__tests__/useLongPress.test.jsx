import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import useLongPress from "../useLongPress";

const Target = ({ onLongPress, onContextMenu, onClick }) => {
  const bind = useLongPress();
  return (
    <div data-testid="target" onClick={onClick} {...bind(onLongPress, { onContextMenu })}>
      message
    </div>
  );
};

const touch = (x = 10, y = 10) => ({ touches: [{ clientX: x, clientY: y }] });

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires after holding, with the pressed element and touch point", () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const el = screen.getByTestId("target");

    fireEvent.touchStart(el, touch(40, 60));
    act(() => vi.advanceTimersByTime(300));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress.mock.calls[0][0]).toMatchObject({ currentTarget: el, clientX: 40, clientY: 60 });
  });

  it("is cancelled by a scroll (finger moves) or an early release", () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const el = screen.getByTestId("target");

    fireEvent.touchStart(el, touch(10, 10));
    fireEvent.touchMove(el, touch(10, 40));
    act(() => vi.advanceTimersByTime(600));

    fireEvent.touchStart(el, touch());
    fireEvent.touchEnd(el);
    act(() => vi.advanceTimersByTime(600));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("swallows the tap that follows a long-press and the touch contextmenu", () => {
    const onContextMenu = vi.fn();
    render(<Target onLongPress={vi.fn()} onContextMenu={onContextMenu} />);
    const el = screen.getByTestId("target");

    fireEvent.touchStart(el, touch());
    act(() => vi.advanceTimersByTime(500));
    expect(fireEvent.contextMenu(el)).toBe(false); // default prevented, handler skipped
    expect(fireEvent.touchEnd(el)).toBe(false); // prevented -> no synthetic click
    expect(onContextMenu).not.toHaveBeenCalled();
  });

  it("passes a mouse right-click through to onContextMenu", () => {
    const onContextMenu = vi.fn();
    render(<Target onLongPress={vi.fn()} onContextMenu={onContextMenu} />);
    fireEvent.contextMenu(screen.getByTestId("target"));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});
