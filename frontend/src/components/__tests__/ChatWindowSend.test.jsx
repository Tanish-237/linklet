import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { vi, describe, beforeEach, afterEach, it, expect } from "vitest";
import ChatWindow from "../chat/ChatWindow";
import { apiClient } from "../../api/apiClient";
import { clearChatMessageCache } from "../chat/hooks/chatMessageCache";

vi.mock("../../api/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// Media messages reach the sender twice — the HTTP response and the socket
// broadcast — in either order. Each file must end up as exactly one bubble.

const makeSocket = () => {
  const handlers = {};
  return {
    connected: true,
    on: (ev, fn) => (handlers[ev] ||= []).push(fn),
    off: (ev, fn) => (handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn)),
    emit: vi.fn(),
    fire: (ev, data) => (handlers[ev] || []).forEach((f) => f(data)),
  };
};

const chat = {
  _id: "c1",
  isGroup: false,
  participants: [
    { _id: "u1", username: "me" },
    { _id: "u2", username: "alice" },
  ],
};

const rowIds = (container) => [...container.querySelectorAll('[id^="msg-"]')].map((r) => r.id);

// Mimics the server: one message per uploaded file, clientId suffixed `:i`
// when a send has several files. The response is held until `respond()`.
const mockSendEndpoint = () => {
  const pending = {};
  apiClient.post.mockImplementation((url, formData) => {
    const clientId = formData.get("clientId");
    const files = [...formData.values()].filter((v) => v instanceof File);
    const audio = formData.get("mediaType") === "audio";
    pending.msgs = files.map((file, i) => ({
      _id: `real${i}`,
      clientId: files.length > 1 ? `${clientId}:${i}` : clientId,
      sender: { _id: "u1", username: "me" },
      chat: "c1",
      media: `https://res.cloudinary.com/demo/${i}`,
      mediaType: audio ? "audio" : "document",
      fileName: audio ? undefined : file.name,
      createdAt: new Date().toISOString(),
    }));
    return new Promise((resolve) => {
      pending.respond = () =>
        resolve({ data: { success: true, data: pending.msgs.length === 1 ? pending.msgs[0] : pending.msgs } });
    });
  });
  return pending;
};

const renderChat = async (socket) => {
  const utils = render(
    <ChatWindow chat={chat} currentUser={{ _id: "u1", username: "me" }} socket={socket} onToggleInfo={vi.fn()} />
  );
  await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
  return utils;
};

const sendFiles = async (container, count) => {
  const files = Array.from({ length: count }, (_, i) => new File(["x"], `doc${i}.pdf`, { type: "application/pdf" }));
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files } });
  fireEvent.submit(container.querySelector("form"));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
};

describe("ChatWindow media sends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearChatMessageCache();
    apiClient.get.mockResolvedValue({ data: { success: true, data: { messages: [], hasMore: false } } });
  });

  for (const order of ["socket first", "response first"]) {
    for (const count of [1, 2]) {
      it(`shows ${count} attachment(s) once each (${order})`, async () => {
        const socket = makeSocket();
        const server = mockSendEndpoint();
        const { container } = await renderChat(socket);
        await sendFiles(container, count);

        await act(async () => {
          if (order === "socket first") {
            server.msgs.forEach((m) => socket.fire("message received", m));
            server.respond();
          } else {
            server.respond();
            await Promise.resolve();
            server.msgs.forEach((m) => socket.fire("message received", m));
          }
        });

        await waitFor(() => expect(rowIds(container)).toEqual(server.msgs.map((m) => `msg-${m._id}`)));
      });
    }
  }

  it("replaces the sending bubble as soon as the broadcast of a multi-file send arrives", async () => {
    const socket = makeSocket();
    const server = mockSendEndpoint();
    const { container } = await renderChat(socket);
    await sendFiles(container, 2);

    // Broadcast lands; the HTTP response is still on its way.
    act(() => server.msgs.forEach((m) => socket.fire("message received", m)));

    expect(rowIds(container)).toEqual(["msg-real0", "msg-real1"]);
  });

  describe("voice notes", () => {
    let OriginalMediaRecorder;
    let originalMediaDevices;

    beforeEach(() => {
      OriginalMediaRecorder = globalThis.MediaRecorder;
      originalMediaDevices = navigator.mediaDevices;
      globalThis.MediaRecorder = class {
        constructor(stream) {
          this.stream = stream;
          this.state = "inactive";
        }
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
      });
      URL.createObjectURL ||= vi.fn(() => "blob:voice");
      URL.revokeObjectURL ||= vi.fn();
    });

    afterEach(() => {
      globalThis.MediaRecorder = OriginalMediaRecorder;
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    });

    it("uploads the recording once and shows a single voice note", async () => {
      const socket = makeSocket();
      const server = mockSendEndpoint();
      const { container } = await renderChat(socket);

      fireEvent.click(screen.getByTitle("Record voice note"));
      fireEvent.click(await screen.findByLabelText("Send voice note"));
      await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));

      const formData = apiClient.post.mock.calls[0][1];
      expect([...formData.values()].filter((v) => v instanceof File)).toHaveLength(1);

      await act(async () => {
        server.msgs.forEach((m) => socket.fire("message received", m));
        server.respond();
      });

      await waitFor(() => expect(rowIds(container)).toEqual(["msg-real0"]));
    });
  });
});
