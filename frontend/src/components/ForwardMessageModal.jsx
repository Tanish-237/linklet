import React, { useState } from "react";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";

const ForwardMessageModal = ({
  isOpen,
  chats,
  selectedMessageCount,
  onConfirmForward,
  onClose,
}) => {
  const [targetChatId, setTargetChatId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleForward = async () => {
    if (!targetChatId) {
      toast.error("Please select a conversation to forward to.");
      return;
    }

    setSubmitting(true);
    try {
      await onConfirmForward(targetChatId);
      onClose();
    } catch (error) {
      toast.error("Failed to forward messages.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b border-violet-500/20 pb-3">
          <h3 className="text-xl font-bold text-violet-400 flex items-center gap-2">
            <span className="material-icons text-violet-400">shortcut</span>
            Forward {selectedMessageCount} Message{selectedMessageCount > 1 ? "s" : ""}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-gray-300 mb-4">
          Select a contact or group to forward the selected message(s) to:
        </p>

        <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-1">
          {chats.length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">
              No conversations available.
            </p>
          ) : (
            chats.map((c) => {
              const isSelected = targetChatId === c._id;
              const name = c.isGroup
                ? c.chatName
                : c.participants?.find((p) => p.username)?.username || "Chat";

              return (
                <div
                  key={c._id}
                  onClick={() => setTargetChatId(c._id)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between border transition-all ${
                    isSelected
                      ? "bg-violet-600/30 border-violet-500/50"
                      : "bg-slate-900/60 border-violet-500/10 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        c.isGroup
                          ? c.groupImage ||
                            "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
                          : c.participants?.find((p) => p.avatar)?.avatar ||
                            "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                      }
                      alt="Avatar"
                      className="w-9 h-9 rounded-full border border-violet-500/20"
                    />
                    <span className="font-medium text-sm text-white">{name}</span>
                  </div>
                  {isSelected && (
                    <span className="material-icons text-violet-400 text-lg">
                      check_circle
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={!targetChatId || submitting}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="material-icons text-base">shortcut</span>
            {submitting ? "Forwarding..." : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal;
