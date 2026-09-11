import React, { useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import ReplyingBanner from "./ReplyingBanner";
import EditingBanner from "./EditingBanner";
import AttachmentPreviewTray from "./AttachmentPreviewTray";
import VoiceNoteRecordingTray from "./VoiceNoteRecordingTray";

const ChatComposer = ({
  newMessage,
  setNewMessage,
  selectedFiles,
  filePreviews,
  replyingTo,
  editingMessage,
  isRecordingAudio,
  recordingSeconds,
  isEmojiPickerOpen,
  setIsEmojiPickerOpen,
  isSending,
  onSendMessage,
  onFileSelect,
  onRemoveFile,
  onCancelReply,
  onCancelEdit,
  onTyping,
  onStartRecordAudio,
  onCancelRecordAudio,
  onStopAndSendAudio,
}) => {
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiBtnRef = useRef(null);

  // Close emoji picker on click outside
  useEffect(() => {
    if (!isEmojiPickerOpen) return;

    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setIsEmojiPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEmojiPickerOpen, setIsEmojiPickerOpen]);

  return (
    <div className="chat-composer-container relative">
      {/* Replying To Banner */}
      <ReplyingBanner replyingTo={replyingTo} onCancelReply={onCancelReply} />

      {/* Editing Message Banner */}
      <EditingBanner
        editingMessage={editingMessage}
        onCancelEdit={onCancelEdit}
      />

      {/* Attachment Previews Tray */}
      <AttachmentPreviewTray
        filePreviews={filePreviews}
        onRemoveFile={onRemoveFile}
      />

      {/* Voice Note Recording Tray or Main Input Bar */}
      {isRecordingAudio ? (
        <VoiceNoteRecordingTray
          recordingSeconds={recordingSeconds}
          onCancelRecord={onCancelRecordAudio}
          onStopAndSend={onStopAndSendAudio}
        />
      ) : (
        <form onSubmit={onSendMessage} className="chat-input-form relative">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileSelect}
            multiple
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="composer-icon-btn"
            title="Attach file"
          >
            <span className="material-icons">attach_file</span>
          </button>

          {/* Emoji Picker Button */}
          <button
            ref={emojiBtnRef}
            type="button"
            onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
            className="composer-icon-btn"
            title="Insert emoji"
          >
            <span className="material-icons">sentiment_satisfied_alt</span>
          </button>

          {/* Floating Emoji Picker Popover - Hover Upwards */}
          {isEmojiPickerOpen && (
            <div ref={emojiPickerRef} className="emoji-picker-container">
              <EmojiPicker
                theme="dark"
                onEmojiClick={(emojiData) => {
                  setNewMessage((prev) => prev + emojiData.emoji);
                }}
              />
            </div>
          )}

          <input
            type="text"
            placeholder={
              filePreviews.length > 0
                ? "Add a caption..."
                : "Type a message..."
            }
            value={newMessage}
            onChange={onTyping}
            className="chat-input"
          />

          {newMessage.trim() || selectedFiles.length > 0 ? (
            <button
              type="submit"
              className="send-btn"
              title="Send message"
            >
              <span className="material-icons">send</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartRecordAudio}
              className="send-btn bg-violet-700 hover:bg-violet-600"
              title="Record voice note"
            >
              <span className="material-icons">mic</span>
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default ChatComposer;
