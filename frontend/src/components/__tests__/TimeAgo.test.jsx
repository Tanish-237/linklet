import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TimeAgo from "../TimeAgo";

describe("TimeAgo Component", () => {
  it("renders formatted timeago string for valid date", () => {
    console.log("TRACE [TimeAgo.test.jsx]: Testing valid date rendering");
    const date = new Date(Date.now() - 60000).toISOString();
    render(<TimeAgo date={date} className="test-time" />);
    const elem = screen.getByText(/ago|just now/i);
    expect(elem).toBeInTheDocument();
  });

  it("returns null when date is missing", () => {
    console.log("TRACE [TimeAgo.test.jsx]: Testing missing date rendering");
    const { container } = render(<TimeAgo date={null} />);
    expect(container.firstChild).toBeNull();
  });
});
