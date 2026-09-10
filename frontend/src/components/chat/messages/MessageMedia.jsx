import React from "react";
import AudioMessagePlayer from "./AudioMessagePlayer";

const MessageMedia = ({
  msg,
  audioState,
  onToggleAudioPlay,
  onSeekAudio,
  onOpenLightbox,
}) => {
  if (!msg.media) return null;

  if (msg.mediaType === "image") {
    return (
      <div className="mt-1">
        <img
          src={msg.media}
          alt="Attachment"
          className="message-media-img cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => onOpenLightbox({ url: msg.media, type: "image" })}
        />
      </div>
    );
  }

  if (msg.mediaType === "video") {
    return (
      <div className="mt-1">
        <div
          className="relative cursor-pointer group"
          onClick={() => onOpenLightbox({ url: msg.media, type: "video" })}
        >
          <video src={msg.media} className="message-media-img" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors rounded-xl">
            <span className="material-icons text-4xl text-white drop-shadow-md">
              play_circle_filled
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (msg.mediaType === "audio") {
    return (
      <div className="mt-1">
        <AudioMessagePlayer
          messageId={msg._id}
          audioUrl={msg.media}
          audioState={audioState}
          onTogglePlay={onToggleAudioPlay}
          onSeek={onSeekAudio}
        />
      </div>
    );
  }

  // Document download card
  return (
    <div className="mt-1">
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
    </div>
  );
};

export default MessageMedia;
