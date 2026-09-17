import React, { useState, useMemo } from "react";
import { toast } from "react-toastify";

const ForwardMessageModal = ({
  isOpen,
  chats = [],
  selectedMessageCount = 0,
  onConfirmForward,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  React.useEffect(() => {
    if (isOpen) {
      setSelectedChatIds([]);
      setSearchQuery("");
    }
  }, [isOpen]);

  const getChatName = (c) => {
    if (c.isGroup) return c.chatName || "Group";
    return c.participants?.find((p) => p.username)?.fullName ||
      c.participants?.find((p) => p.username)?.username ||
      "Chat";
  };

  const getChatAvatar = (c) => {
    if (c.isGroup) return c.groupImage || "https://cdn-icons-png.flaticon.com/512/3177/3177440.png";
    return c.participants?.find((p) => p.avatar)?.avatar || "https://cdn-icons-png.flaticon.com/512/1326/1326382.png";
  };

  // This hook must run on every render regardless of `isOpen` — React
  // requires hooks to be called in the same order every time, so the
  // `if (!isOpen) return null;` early return has to come AFTER every hook
  // call, not before. It used to sit above this useMemo, which is the classic
  // "conditional hook call" bug (harmless by luck most of the time, but can
  // corrupt this component's hook state/crash under React's stricter modes).
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter((c) => getChatName(c).toLowerCase().includes(q));
  }, [chats, searchQuery]);

  if (!isOpen) return null;

  const toggleChatSelect = (chatId) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleSend = async () => {
    if (selectedChatIds.length === 0) {
      toast.error("Please select at least one conversation.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirmForward(selectedChatIds);
    } catch {
      toast.error("Failed to forward messages.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-md bg-gray-900 border border-violet-500/20 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white tracking-tight">
            Send to
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({selectedMessageCount} message{selectedMessageCount !== 1 ? "s" : ""})
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-800/60">
          <div className="relative flex items-center">
            <span className="material-icons absolute left-3 text-gray-400 text-lg pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 rounded-xl text-sm text-gray-100 placeholder-gray-500 outline-none transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-gray-400 hover:text-white"
              >
                <span className="material-icons text-base">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">No chats found.</div>
          ) : (
            filteredChats.map((c) => {
              const isSelected = selectedChatIds.includes(c._id);
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggleChatSelect(c._id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left ${
                    isSelected ? "bg-violet-600/10" : ""
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={getChatAvatar(c)}
                      alt={getChatName(c)}
                      className="w-11 h-11 rounded-full object-cover border border-violet-500/20"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{getChatName(c)}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      {c.isGroup ? `${c.participants?.length || 0} members` : "Direct message"}
                    </div>
                  </div>
                  {/* WhatsApp-style checkbox */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected
                        ? "bg-violet-600 border-violet-600"
                        : "border-gray-600"
                    }`}
                  >
                    {isSelected && (
                      <span className="material-icons text-white text-sm leading-none">check</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer — send button */}
        <div className="px-4 py-4 border-t border-gray-800 bg-gray-900">
          {selectedChatIds.length > 0 && (
            <div className="text-xs text-violet-300 mb-2 font-medium">
              {selectedChatIds.length} conversation{selectedChatIds.length > 1 ? "s" : ""} selected
            </div>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={selectedChatIds.length === 0 || submitting}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <span className="material-icons text-base">send</span>
            {submitting ? "Sending..." : `Send${selectedChatIds.length > 1 ? ` to ${selectedChatIds.length}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal;
