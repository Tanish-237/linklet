import { describe, it, expect, beforeEach, vi } from "vitest";
import useAuthStore from "../useAuthStore";
import { apiClient } from "../../api/apiClient";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockStorage = {};
const fakeLocalStorage = {
  getItem: vi.fn((key) => mockStorage[key] || null),
  setItem: vi.fn((key, value) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
};

globalThis.localStorage = fakeLocalStorage;

describe("useAuthStore Zustand Store Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeLocalStorage.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  });

  it("updates state properly when setUser is called", () => {
    console.log("TRACE [useAuthStore.test.js]: Testing setUser action");
    const mockUser = { _id: "u123", username: "alex", fullName: "Alex Smith" };
    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    console.log("TRACE [useAuthStore.test.js]: setUser verified successfully");
  });

  it("clears user and sets unauthenticated on logout", async () => {
    console.log("TRACE [useAuthStore.test.js]: Testing logout action");
    apiClient.post.mockResolvedValue({ data: { success: true } });

    useAuthStore.setState({
      user: { _id: "u123", username: "alex" },
      isAuthenticated: true,
      isLoading: false,
    });
    localStorage.setItem("accessToken", "fake-token");

    // Mock window.location
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: "" };

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem("accessToken")).toBeNull();
    console.log("TRACE [useAuthStore.test.js]: Logout verified successfully");

    window.location = originalLocation;
  });

  it("successfully populates user when checkAuth succeeds", async () => {
    console.log("TRACE [useAuthStore.test.js]: Testing checkAuth successful response");
    const verifiedUser = { _id: "u123", username: "alex" };
    apiClient.get.mockResolvedValue({
      data: { success: true, user: verifiedUser },
    });

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(verifiedUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    console.log("TRACE [useAuthStore.test.js]: checkAuth verified successfully");
  });

  it("handles 401 unauthenticated response by resetting user", async () => {
    console.log("TRACE [useAuthStore.test.js]: Testing checkAuth 401 error response");
    useAuthStore.setState({
      user: { _id: "u123", username: "alex" },
      isAuthenticated: true,
    });

    apiClient.get.mockRejectedValue({
      response: { status: 401, data: { message: "Unauthorized" } },
    });

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    console.log("TRACE [useAuthStore.test.js]: 401 checkAuth reset verified successfully");
  });

  it("resets auth state when global 'auth-expired' event is triggered", () => {
    console.log("TRACE [useAuthStore.test.js]: Testing global auth-expired event handling");
    useAuthStore.setState({
      user: { _id: "u999", username: "expiredUser" },
      isAuthenticated: true,
    });

    window.dispatchEvent(new Event("auth-expired"));

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    console.log("TRACE [useAuthStore.test.js]: auth-expired event reset verified successfully");
  });
});

