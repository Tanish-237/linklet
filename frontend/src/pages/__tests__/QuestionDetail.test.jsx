import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { ThreadedCommentItem } from "../QuestionDetail";

// Builds a straight-line reply chain: comment-0 -> comment-1 -> ... -> comment-N,
// each replying to the previous one, so rendering comment-0 recursively renders
// the whole chain via ThreadedCommentItem's own childReplies lookup.
const buildChain = (length) => {
  const comments = [];
  for (let i = 0; i < length; i++) {
    comments.push({
      _id: `c${i}`,
      text: `reply level ${i}`,
      createdAt: new Date().toISOString(),
      userId: { _id: `user${i}`, username: `user${i}` },
      parentId: i === 0 ? null : `c${i - 1}`,
      upvotes: [],
      downvotes: [],
    });
  }
  return comments;
};

const renderChain = (length) => {
  const allComments = buildChain(length);
  const { container } = render(
    <MemoryRouter>
      <ThreadedCommentItem
        comment={allComments[0]}
        allComments={allComments}
        answerId="answer1"
        questionId="question1"
        currentUserId="viewer1"
        currentUserRole="user"
        opUserId="op1"
        onAddComment={() => {}}
        onVoteComment={() => {}}
        onDeleteComment={() => {}}
        depth={0}
      />
    </MemoryRouter>
  );
  return container;
};

describe("ThreadedCommentItem — nesting depth cap", () => {
  it("indents replies with .qd-nested up through the 4th nesting level", () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] ThreadedCommentItem › qd-nested applies for depth 1-4");
    // Chain of 5 comments = depths 0,1,2,3,4 — all within the cap.
    const container = renderChain(5);

    const flatNodes = container.querySelectorAll(".qd-nested-flat");
    const nestedNodes = container.querySelectorAll(".qd-nested");

    expect(flatNodes).toHaveLength(0);
    // depths 1,2,3,4 get qd-nested (depth 0 gets neither class).
    expect(nestedNodes).toHaveLength(4);
    console.log("[TEST] Verified: 4 nested levels, none flattened yet");
  });

  it("stops compounding indent beyond MAX_INDENT_DEPTH (4) — deep threads get qd-nested-flat instead of an ever-growing margin", () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] ThreadedCommentItem › qd-nested-flat applies beyond depth 4");
    // Chain of 8 comments = depths 0..7 — three levels (5,6,7) exceed the cap.
    const container = renderChain(8);

    const flatNodes = container.querySelectorAll(".qd-nested-flat");
    const nestedNodes = container.querySelectorAll(".qd-nested");

    expect(nestedNodes).toHaveLength(4); // depths 1-4
    expect(flatNodes).toHaveLength(3); // depths 5,6,7
    console.log("[TEST] Verified: indent stops growing past depth 4, deeper replies flatten instead");
  });

  it("renders the full reply chain's text regardless of depth", () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] ThreadedCommentItem › all reply text renders even when flattened");
    const container = renderChain(8);

    expect(container.textContent).toContain("reply level 0");
    expect(container.textContent).toContain("reply level 7");
    console.log("[TEST] Verified: flattening only affects indentation, not content");
  });
});
