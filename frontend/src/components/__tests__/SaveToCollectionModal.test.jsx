import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import SaveToCollectionModal from "../SaveToCollectionModal";
import * as collectionApi from "../../api/collection.api";
import { toast } from "sonner";

vi.mock("../../api/collection.api", () => ({
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  toggleResourceInCollection: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SaveToCollectionModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders collections successfully", async () => {
    collectionApi.getCollections.mockResolvedValue([
      { _id: "c1", name: "Math Notes", coverColor: "#fff", resources: [] },
    ]);

    render(
      <SaveToCollectionModal
        resourceId="r1"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Should show loading spinner initially (if we could catch it), then list
    await waitFor(() => {
      expect(screen.getByText("Math Notes")).toBeInTheDocument();
    });
    
    // The button should say "Save" since resources is empty
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("handles creating a new collection", async () => {
    collectionApi.getCollections.mockResolvedValue([]);
    collectionApi.createCollection.mockResolvedValue({
      _id: "c2",
      name: "New Board",
      coverColor: "#000",
      resources: ["r1"],
    });

    render(
      <SaveToCollectionModal
        resourceId="r1"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = screen.getByPlaceholderText("Create new collection...");
    fireEvent.change(input, { target: { value: "New Board" } });

    const createBtn = screen.getByRole("button", { name: "Create" });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(collectionApi.createCollection).toHaveBeenCalledWith({
        name: "New Board",
        initialResourceId: "r1",
      });
      expect(toast.success).toHaveBeenCalledWith("Collection created and resource saved!");
      expect(mockOnSuccess).toHaveBeenCalled();
      // Should now render the new collection
      expect(screen.getByText("New Board")).toBeInTheDocument();
    });
  });

  it("handles toggling a resource in a collection", async () => {
    collectionApi.getCollections.mockResolvedValue([
      { _id: "c1", name: "Math Notes", coverColor: "#fff", resources: [] },
    ]);
    collectionApi.toggleResourceInCollection.mockResolvedValue({
      added: true,
      message: "Resource added to collection",
    });

    render(
      <SaveToCollectionModal
        resourceId="r1"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Math Notes")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByText("Save");
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(collectionApi.toggleResourceInCollection).toHaveBeenCalledWith("c1", "r1");
      expect(toast.success).toHaveBeenCalledWith("Resource added to collection");
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
