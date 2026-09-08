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
  it("renders Class Section and Sub-Section inputs and transforms inputs to uppercase alphanumeric", () => {
    console.log("TRACE [Register.test.jsx]: Testing section and sub-section inputs rendering and formatting");

    render(
      <HelmetProvider>
        <BrowserRouter>
          <Register />
        </BrowserRouter>
      </HelmetProvider>
    );

    const sectionInput = screen.getByLabelText(/Class Section/i);
    expect(sectionInput).toBeInTheDocument();
    expect(sectionInput).toHaveAttribute("placeholder", "Eg. D, J, A, CE");

    // Test main section typing (e.g. "j" -> "J", "d" -> "D")
    fireEvent.change(sectionInput, { target: { value: "j" } });
    console.log("TRACE [Register.test.jsx]: sectionInput value after typing 'j':", sectionInput.value);
    expect(sectionInput.value).toBe("J");

    fireEvent.change(sectionInput, { target: { value: "ce" } });
    console.log("TRACE [Register.test.jsx]: sectionInput value after typing 'ce':", sectionInput.value);
    expect(sectionInput.value).toBe("CE");

    // Test sub-section typing (e.g. "ce3" -> "CE3", "df5" -> "DF5")
    const subSectionInput = screen.getByLabelText(/Sub-Section/i);
    expect(subSectionInput).toBeInTheDocument();
    expect(subSectionInput).toHaveAttribute("placeholder", "Eg. CE3, DF5, A1");

    fireEvent.change(subSectionInput, { target: { value: "ce3" } });
    console.log("TRACE [Register.test.jsx]: subSectionInput value after typing 'ce3':", subSectionInput.value);
    expect(subSectionInput.value).toBe("CE3");

    fireEvent.change(subSectionInput, { target: { value: "df-5" } });
    console.log("TRACE [Register.test.jsx]: subSectionInput value after typing 'df-5':", subSectionInput.value);
    expect(subSectionInput.value).toBe("DF5");
  });
});
