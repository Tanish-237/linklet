import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ChatInfoPanel from "../ChatInfoPanel";
import { apiClient } from "../../api/apiClient";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

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

  it("switches to Media tab and fetches chat media gallery", async () => {
    console.log("TRACE [ChatInfoPanel.test.jsx]: Testing Media tab and gallery rendering");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          messages: [
            {
              _id: "m_img1",
              media: "https://example.com/test-photo.jpg",
              mediaType: "image",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

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

    const mediaTabBtn = screen.getByText("Media");
    fireEvent.click(mediaTabBtn);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/chat/message/chat123")
      );
      expect(screen.getByAltText("media")).toBeInTheDocument();
    });
    console.log("TRACE [ChatInfoPanel.test.jsx]: Confirmed media tab gallery fetched and rendered");
  });

  it("renders group details with admin badge and prevents saving identical name", async () => {
    console.log("TRACE [ChatInfoPanel.test.jsx]: Testing group details and same-name rename validation");
    const groupChat = {
      _id: "group999",
      chatName: "Developers Hangout",
      isGroup: true,
      groupAdmin: { _id: "user1", username: "tanish-mittal" },
      groupAdmins: [{ _id: "user1", username: "tanish-mittal" }],
      participants: [
        { _id: "user1", username: "tanish-mittal", fullName: "Tanish Mittal" },
        { _id: "user2", username: "shankkyvibe", fullName: "Shashank Kanaujiya" },
      ],
    };

    const onUpdateChat = vi.fn();

    render(
      <BrowserRouter>
        <ChatInfoPanel
          chat={groupChat}
          currentUser={currentUser}
          onClose={vi.fn()}
          onUpdateChat={onUpdateChat}
        />
      </BrowserRouter>
    );

    // Verify group name and participant count rendered
    expect(screen.getByText("Developers Hangout")).toBeInTheDocument();
    expect(screen.getByText("Group Admin")).toBeInTheDocument();
    expect(screen.getByText(/Participants \(2\)/i)).toBeInTheDocument();

    // Click edit rename button
    const editBtn = screen.getByLabelText("Rename group");
    fireEvent.click(editBtn);

    // In edit mode: input prefilled with "Developers Hangout"
    const input = screen.getByPlaceholderText("Enter group name...");
    expect(input.value).toBe("Developers Hangout");

    // Because the name is unchanged, helper warning should appear and Save should be disabled
    expect(
      screen.getByText("New name cannot be the same as current name")
    ).toBeInTheDocument();
    const saveBtn = screen.getByText("Save");
    expect(saveBtn).toBeDisabled();

    // Type a new name
    fireEvent.change(input, { target: { value: "Engineers Hangout" } });
    expect(
      screen.queryByText("New name cannot be the same as current name")
    ).toBeNull();
    expect(saveBtn).not.toBeDisabled();

    // Click Save
    apiClient.put.mockResolvedValueOnce({
      data: { success: true, data: { ...groupChat, chatName: "Engineers Hangout" } },
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith("/chat/group/rename", {
        chatId: "group999",
        chatName: "Engineers Hangout",
      });
      expect(onUpdateChat).toHaveBeenCalledWith(
        expect.objectContaining({ chatName: "Engineers Hangout" })
      );
    });
    console.log("TRACE [ChatInfoPanel.test.jsx]: Group rename validation and update verified");
  });

  it("allows group admin to promote member to group admin", async () => {
    console.log("TRACE [ChatInfoPanel.test.jsx]: Testing member promotion to admin");
    const groupChat = {
      _id: "group999",
      chatName: "Core Team",
      isGroup: true,
      groupAdmin: { _id: "user1", username: "tanish-mittal" },
      groupAdmins: [{ _id: "user1", username: "tanish-mittal" }],
      participants: [
        { _id: "user1", username: "tanish-mittal", fullName: "Tanish Mittal" },
        { _id: "user2", username: "shankkyvibe", fullName: "Shashank Kanaujiya" },
      ],
    };

    const onUpdateChat = vi.fn();

    render(
      <BrowserRouter>
        <ChatInfoPanel
          chat={groupChat}
          currentUser={currentUser}
          onClose={vi.fn()}
          onUpdateChat={onUpdateChat}
        />
      </BrowserRouter>
    );

    // Open member options menu for user2
    const optionsBtn = screen.getByLabelText("Options for shankkyvibe");
    fireEvent.click(optionsBtn);

    // Click "Make group admin"
    const promoteBtn = screen.getByText("Make group admin");
    expect(promoteBtn).toBeInTheDocument();

    apiClient.put.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          ...groupChat,
          groupAdmins: [
            { _id: "user1" },
            { _id: "user2" },
          ],
        },
      },
    });

    fireEvent.click(promoteBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith("/chat/group/promote", {
        chatId: "group999",
        userId: "user2",
      });
      expect(onUpdateChat).toHaveBeenCalled();
    });
    console.log("TRACE [ChatInfoPanel.test.jsx]: Promote member action verified");
  });
});
