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

  it("renders compact mobile category pills bar and filters questions when clicked", async () => {
    console.log("TRACE [HelpForum.test.jsx]: Testing mobile horizontal category pills");
    renderComponent();

    // Wait for categories to load
    await waitFor(() => {
      const allCatBtn = document.getElementById("hf-mobile-cat-all");
      console.log("TRACE [HelpForum.test.jsx]: Looking for hf-mobile-cat-all:", Boolean(allCatBtn));
      expect(allCatBtn).toBeInTheDocument();
      expect(allCatBtn).toHaveClass("active");
    });

    // Check category pills from metadata (General, Academic, Tech)
    const academicBtn = document.getElementById("hf-mobile-cat-academic");
    console.log("TRACE [HelpForum.test.jsx]: Found Academic category pill:", Boolean(academicBtn));
    expect(academicBtn).toBeInTheDocument();
    expect(academicBtn.textContent).toBe("Academic");

    // Click Academic pill to filter
    fireEvent.click(academicBtn);
    console.log("TRACE [HelpForum.test.jsx]: Clicked Academic pill, verifying getQuestions called with category");

    await waitFor(() => {
      expect(academicBtn).toHaveClass("active");
      expect(questionApi.getQuestions).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "Academic",
        })
      );
    });

    console.log("TRACE [HelpForum.test.jsx]: Mobile category pills correctly rendered and filter questions");
  });

  it("renders question card with clear full-width title, solved badge, and author metadata", async () => {
    console.log("TRACE [HelpForum.test.jsx]: Testing QuestionCard layout with title and badges");
    questionApi.getQuestions.mockResolvedValue({
      data: [
        {
          _id: "q-101",
          title: "No problem with comments getting accepted",
          body: "Just want my comments to get accepted",
          category: "General",
          tags: ["discussion"],
          acceptedAnswers: ["ans-1"],
          answers: [{ _id: "ans-1", isAccepted: true }],
          upvotes: [{ _id: "u1" }],
          downvotes: [],
          views: 12,
          userId: {
            _id: "user-long",
            username: "hi_its_me_im_the_problem_its_me",
            avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=problem",
          },
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
      hasMore: false,
    });

    renderComponent();

    const cardTitle = await screen.findByText("No problem with comments getting accepted");
    console.log("TRACE [HelpForum.test.jsx]: Found question title:", cardTitle.textContent);
    expect(cardTitle).toBeInTheDocument();
    expect(cardTitle).toHaveClass("hf-card-title");

    const solvedBadge = document.querySelector(".hf-solved-badge");
    console.log("TRACE [HelpForum.test.jsx]: Found solved badge:", solvedBadge.textContent);
    expect(solvedBadge).toBeInTheDocument();
    expect(solvedBadge.textContent).toContain("Solved");

    const authorName = screen.getByText("hi_its_me_im_the_problem_its_me");
    console.log("TRACE [HelpForum.test.jsx]: Found author name:", authorName.textContent);
    expect(authorName).toBeInTheDocument();
    expect(authorName).toHaveClass("hf-author-name");

    const answerCount = screen.getByText(/1\s*answer/i);
    console.log("TRACE [HelpForum.test.jsx]: Found answer count pill:", answerCount.textContent);
    expect(answerCount).toBeInTheDocument();

    console.log("TRACE [HelpForum.test.jsx]: QuestionCard verified with complete title and layout");
  });

  const questionOf = (id, title) => ({
    _id: id, title, body: "", category: "General", tags: [], acceptedAnswers: [], answers: [],
    upvotes: [], downvotes: [], views: 0,
    userId: { _id: "author1", username: "someone", avatar: "" },
    createdAt: new Date().toISOString(),
  });

  it("drops a slow response for a previous filter so it can't overwrite the list for the current one", async () => {
    console.log("TRACE [HelpForum.test.jsx]: stale response for an old filter is ignored");
    let resolveSlow;
    // 1st call (initial "all" view) is slow; 2nd call (Academic category) answers first.
    questionApi.getQuestions
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }))
      .mockResolvedValueOnce({ data: [questionOf("q-new", "Academic question")], nextCursor: null, hasMore: false });

    renderComponent();
    const academicBtn = await waitFor(() => {
      const el = document.getElementById("hf-mobile-cat-academic");
      expect(el).toBeInTheDocument();
      return el;
    });

    fireEvent.click(academicBtn);
    expect(await screen.findByText("Academic question")).toBeInTheDocument();

    // The slow, now-obsolete "all" response finally arrives...
    resolveSlow({ data: [questionOf("q-old", "Stale question from the old filter")], nextCursor: null, hasMore: false });
    await new Promise((r) => setTimeout(r, 30));

    console.log("TRACE [HelpForum.test.jsx]: stale question visible? ", Boolean(screen.queryByText("Stale question from the old filter")));
    expect(screen.queryByText("Stale question from the old filter")).not.toBeInTheDocument();
    expect(screen.getByText("Academic question")).toBeInTheDocument();
  });

  it("'Load more' sends back the API's opaque cursor unchanged (date or offset) and appends the next page", async () => {
    console.log("TRACE [HelpForum.test.jsx]: opaque cursor round-trip");
    questionApi.getQuestions
      .mockResolvedValueOnce({ data: [questionOf("q1", "First page question")], nextCursor: "o:15", hasMore: true })
      .mockResolvedValueOnce({ data: [questionOf("q2", "Second page question")], nextCursor: null, hasMore: false });

    renderComponent();
    await screen.findByText("First page question");

    fireEvent.click(await screen.findByRole("button", { name: /load more/i }));

    expect(await screen.findByText("Second page question")).toBeInTheDocument();
    expect(screen.getByText("First page question")).toBeInTheDocument();
    expect(questionApi.getQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "o:15" }));
  });
});
