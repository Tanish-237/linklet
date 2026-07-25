import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ChatInfoPanel from "../ChatInfoPanel";

describe("ChatInfoPanel Component", () => {
  const mockChat = {
    _id: "chat123",
    isGroup: false,
    participants: [
      {
        _id: "user1",
        username: "tanish-mittal",
        fullName: "Tanish Mittal",
        avatar: "avatar1.png",
      },
      {
        _id: "user2",
        username: "shankkyvibe",
        fullName: "Shashank Kanaujiya",
        avatar: "avatar2.png",
        bio: "Full Stack Dev",
        phoneNumber: "+91 9876543210",
        department: "Computer Science and Engineering",
        year: "Final",
        userType: "Student",
      },
    ],
  };

  const currentUser = { _id: "user1", username: "tanish-mittal" };

  it("renders 1:1 contact details with full name, handle, bio, phone, and abbreviated branch", () => {
    console.log("TRACE [ChatInfoPanel.test.jsx]: Testing 1:1 contact details render");
    render(
      <BrowserRouter>
        <ChatInfoPanel
          chat={mockChat}
          currentUser={currentUser}
          onClose={vi.fn()}
          onUpdateChat={vi.fn()}
        />
      </BrowserRouter>
    );

    expect(screen.getByText("Shashank Kanaujiya")).toBeInTheDocument();
    expect(screen.getByText("@shankkyvibe")).toBeInTheDocument();
    expect(screen.getByText("Full Stack Dev")).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText("CSE")).toBeInTheDocument();
  });
});
