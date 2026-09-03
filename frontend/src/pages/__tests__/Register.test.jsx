import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Register from "../Register";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    fetchUser: vi.fn(),
  }),
}));

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe("Register Component Tests", () => {
  it("renders Class Section input and transforms input to uppercase", () => {
    console.log("TRACE [Register.test.jsx]: Testing section input rendering and uppercase behavior");

    render(
      <HelmetProvider>
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      </HelmetProvider>
    );

    const sectionInput = screen.getByLabelText(/Class Section/i);
    expect(sectionInput).toBeInTheDocument();
    expect(sectionInput).toHaveAttribute("placeholder", "Eg. A1, B2, etc");

    // Type lowercase "b" followed by "1"
    fireEvent.change(sectionInput, { target: { value: "b" } });
    expect(sectionInput.value).toBe("B");

    fireEvent.change(sectionInput, { target: { value: "b1" } });
    console.log("TRACE [Register.test.jsx]: sectionInput value after typing 'b1':", sectionInput.value);
    expect(sectionInput.value).toBe("B1");

    // Invalid 2nd character (like '3') should be filtered out
    fireEvent.change(sectionInput, { target: { value: "B3" } });
    console.log("TRACE [Register.test.jsx]: sectionInput value after typing 'B3':", sectionInput.value);
    expect(sectionInput.value).toBe("B");

    // Valid second character '2'
    fireEvent.change(sectionInput, { target: { value: "B2" } });
    console.log("TRACE [Register.test.jsx]: sectionInput value after typing 'B2':", sectionInput.value);
    expect(sectionInput.value).toBe("B2");
  });
});
