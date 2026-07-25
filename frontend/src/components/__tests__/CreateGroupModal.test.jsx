import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import CreateGroupModal from "../CreateGroupModal";
import { apiClient } from "../../api/apiClient";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("CreateGroupModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    console.log("TRACE [CreateGroupModal.test.jsx]: Testing hidden modal state");
    const { container } = render(
      <CreateGroupModal isOpen={false} onClose={vi.fn()} onGroupCreated={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders group creation form when isOpen is true", () => {
    console.log("TRACE [CreateGroupModal.test.jsx]: Testing visible modal state");
    render(
      <CreateGroupModal isOpen={true} onClose={vi.fn()} onGroupCreated={vi.fn()} />
    );

    expect(screen.getByText("Create New Group")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Project Team Alpha")).toBeInTheDocument();
  });

  it("allows typing group name and searching users", async () => {
    console.log("TRACE [CreateGroupModal.test.jsx]: Testing user search inside group modal");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: [{ _id: "u123", username: "alice", fullName: "Alice Smith" }],
      },
    });

    render(
      <CreateGroupModal isOpen={true} onClose={vi.fn()} onGroupCreated={vi.fn()} />
    );

    const nameInput = screen.getByPlaceholderText("e.g. Project Team Alpha");
    fireEvent.change(nameInput, { target: { value: "Design Squad" } });
    expect(nameInput.value).toBe("Design Squad");

    const searchInput = screen.getByPlaceholderText("Search user by name or username...");
    fireEvent.change(searchInput, { target: { value: "ali" } });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/chat/search?query=ali");
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
  });
});
