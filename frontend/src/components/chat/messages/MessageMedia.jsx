import React from "react";
import AudioMessagePlayer from "./AudioMessagePlayer";

const MessageMedia = ({
  msg,
  isSent,
  isRecipientOnline = false,
  formatMessageClock,
  renderDeliveryTicks,
  audioState,
  onToggleAudioPlay,
  onSeekAudio,
  onOpenLightbox,
}) => {
  if (!msg.media) return null;

  if (msg.mediaType === "image") {
    const hasCaption = Boolean(msg.content);
    return (
      <div className={`relative ${hasCaption ? "rounded-t-xl rounded-b-sm overflow-hidden" : "rounded-xl overflow-hidden"}`}>
        <img
          src={msg.media}
          alt="Attachment"
          className="message-media-img cursor-pointer hover:opacity-95 transition-opacity block w-full object-cover"
          onClick={() => onOpenLightbox({ url: msg.media, type: "image" })}
        />
        {!hasCaption && formatMessageClock && (
          <div className="absolute bottom-1.5 right-2 flex items-center px-1.5 py-0.5 rounded-md bg-black/65 backdrop-blur-sm text-[11px] text-white/95 select-none shadow pointer-events-none">
            <span>{formatMessageClock(msg.createdAt)}</span>
            {isSent && (
              <span className="ml-1.5 flex items-center">
                {renderDeliveryTicks && renderDeliveryTicks(msg, isSent, isRecipientOnline)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (msg.mediaType === "video") {
    const hasCaption = Boolean(msg.content);
    return (
      <div className={`relative ${hasCaption ? "rounded-t-xl rounded-b-sm overflow-hidden" : "rounded-xl overflow-hidden"}`}>
        <div
          className="relative cursor-pointer group"
          onClick={() => onOpenLightbox({ url: msg.media, type: "video" })}
        >
          <video src={msg.media} className="message-media-img block w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors rounded-xl">
            <span className="material-icons text-4xl text-white drop-shadow-md">
              play_circle_filled
            </span>
          </div>
        </div>
        {!hasCaption && formatMessageClock && (
          <div className="absolute bottom-1.5 right-2 flex items-center px-1.5 py-0.5 rounded-md bg-black/65 backdrop-blur-sm text-[11px] text-white/95 select-none shadow pointer-events-none">
            <span>{formatMessageClock(msg.createdAt)}</span>
            {isSent && (
              <span className="ml-1.5 flex items-center">
                {renderDeliveryTicks && renderDeliveryTicks(msg, isSent, isRecipientOnline)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (msg.mediaType === "audio") {
    return (
      <div>
        <AudioMessagePlayer
          messageId={msg._id}
          audioUrl={msg.media}
          audioState={audioState}
          onTogglePlay={onToggleAudioPlay}
          onSeek={onSeekAudio}
          msg={msg}
          isSent={isSent}
          isRecipientOnline={isRecipientOnline}
          formatMessageClock={formatMessageClock}
          renderDeliveryTicks={renderDeliveryTicks}
        />
      </div>
    );
  }

  // Document download card
  return (
    <div>
      <a
        href={msg.media}
        target="_blank"
        rel="noreferrer"
        className="doc-card flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border border-violet-500/20 hover:border-violet-500/40 hover:bg-black/40 transition-all cursor-pointer"
      >
        <div className="doc-icon-badge w-10 h-10 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
          <span className="material-icons text-xl text-violet-300">
            description
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-violet-200 truncate">
            Attachment Document
          </div>
          <div className="text-[10px] text-gray-400">Click to download</div>
        </div>
        <span className="material-icons text-sm text-violet-400">download</span>
      </a>
      {!msg.content && formatMessageClock && (
        <div className="flex items-center justify-end gap-1 mt-1 text-[11px] opacity-80 select-none">
          <span>{formatMessageClock(msg.createdAt)}</span>
          {renderDeliveryTicks && renderDeliveryTicks(msg, isSent, isRecipientOnline)}
        </div>
      )}
    </div>
  );
};

export default MessageMedia;
