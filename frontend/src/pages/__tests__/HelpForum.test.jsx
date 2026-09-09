import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import HelpForum from "../HelpForum";
import * as questionApi from "../../api/question.api";
import useAuthStore from "../../store/useAuthStore";

vi.mock("../../api/question.api", () => ({
  getQuestions: vi.fn(),
  getQuestionMetadata: vi.fn(),
  getTagCloud: vi.fn(),
  getForumStats: vi.fn(),
  createQuestion: vi.fn(),
  voteQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
}));

vi.mock("../../store/useAuthStore", () => ({
  default: vi.fn(),
}));

describe("HelpForum Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.mockReturnValue({
      user: { _id: "user123", username: "alex", fullName: "Alex Smith" },
    });
    questionApi.getQuestions.mockResolvedValue({
      questions: [],
      pagination: { totalPages: 1, total: 0 },
    });
    questionApi.getQuestionMetadata.mockResolvedValue({
      categories: ["General", "Academic", "Tech"],
      popularTags: ["react", "javascript"],
    });
    questionApi.getTagCloud.mockResolvedValue([]);
    questionApi.getForumStats.mockResolvedValue([
      { _id: "General", count: 2 },
    ]);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <HelpForum />
      </BrowserRouter>
    );
  };

  it("renders crisp white header and modernized Ask Question button, opening modal with solid primary button", async () => {
    console.log("TRACE [HelpForum.test.jsx]: Rendering HelpForum component");
    renderComponent();

    const header = await screen.findByRole("heading", { level: 1, name: /Help Forum/i });
    console.log("TRACE [HelpForum.test.jsx]: Found header title:", header.textContent);
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("hf-header-title");

    const askBtn = screen.getByRole("button", { name: /add\s*Ask Question/i });
    console.log("TRACE [HelpForum.test.jsx]: Found Ask Question button:", askBtn.className);
    expect(askBtn).toBeInTheDocument();
    expect(askBtn).toHaveClass("hf-ask-btn");

    fireEvent.click(askBtn);
    console.log("TRACE [HelpForum.test.jsx]: Clicked Ask Question button, verifying modal opens");

    await waitFor(() => {
      const modalTitle = document.querySelector(".hf-modal-title");
      console.log("TRACE [HelpForum.test.jsx]: Found modalTitle:", modalTitle?.textContent);
      expect(modalTitle).toBeInTheDocument();
      const submitBtn = document.querySelector(".hf-btn-primary");
      console.log("TRACE [HelpForum.test.jsx]: Found submitBtn:", submitBtn?.className);
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).toHaveClass("hf-btn-primary");
    });
    console.log("TRACE [HelpForum.test.jsx]: Modal verified with solid primary action button");
  });
});
