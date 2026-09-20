import React from "react";
import { formatAudioTime } from "../hooks/useAudioPlayback";
import defaultAvatar from "../../../assets/default-avatar.webp";

const WAVEFORM_BARS = [
  5, 7, 10, 14, 18, 22, 24, 20, 16, 13, 15, 17, 18, 17, 16, 18,
  17, 16, 15, 17, 16, 15, 16, 17, 16, 15, 14, 13, 14, 12, 9, 6
];

const AudioMessagePlayer = ({
  messageId,
  audioUrl,
  audioState = { isPlaying: false, currentTime: 0, duration: 0 },
  onTogglePlay,
  onSeek,
  msg,
  isSent,
  isRecipientOnline = false,
  formatMessageClock,
  renderDeliveryTicks,
}) => {
  const percent = audioState.duration
    ? Math.min(100, Math.max(0, (audioState.currentTime / audioState.duration) * 100))
    : 0;

  const senderAvatar =
    msg?.sender?.avatar ||
    defaultAvatar;

  return (
    <div className="audio-player-widget flex items-center gap-3 py-1 px-1 min-w-[270px] max-w-[340px]">
      {/* 1. Sender Avatar with overlapping blue microphone badge */}
      <div className="relative flex-shrink-0 self-center">
        <img
          src={senderAvatar}
          alt={msg?.sender?.username || "Voice note"}
          className="w-12 h-12 rounded-full object-cover border border-white/10"
        />
        <div className="absolute -bottom-1 -right-1 flex items-center justify-center">
          <span className="material-icons text-[#53bdeb] text-[18px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] select-none">
            mic
          </span>
        </div>
      </div>

      {/* 2. Triangle Play/Pause Button */}
      <button
        type="button"
        onClick={() => onTogglePlay(messageId, audioUrl)}
        className="flex-shrink-0 p-1 text-gray-300 hover:text-white transition-colors cursor-pointer"
        aria-label={audioState.isPlaying ? "Pause voice note" : "Play voice note"}
      >
        <span className="material-icons text-[32px] leading-none">
          {audioState.isPlaying ? "pause" : "play_arrow"}
        </span>
      </button>

      {/* 3. Waveform Scrubber & Bottom Row */}
      <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
        {/* Waveform Scrubber */}
        <div
          className="audio-waveform-container relative flex items-center h-6 cursor-pointer select-none"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (onSeek) onSeek(messageId, pos);
          }}
        >
          {/* Blue Scrubber Dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#53bdeb] shadow-md z-10 pointer-events-none transition-all duration-75"
            style={{ left: `${percent}%` }}
          />

          {/* Waveform Vertical Bars */}
          <div className="flex items-center gap-[2px] w-full h-full">
            {WAVEFORM_BARS.map((height, idx) => {
              const barPercent = (idx / (WAVEFORM_BARS.length - 1)) * 100;
              const isPlayed = barPercent <= percent;
              return (
                <div
                  key={idx}
                  className="flex-1 rounded-full transition-colors duration-75"
                  style={{
                    height: `${height}px`,
                    backgroundColor: isPlayed ? "#53bdeb" : "rgba(255, 255, 255, 0.4)",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom Row: Duration on left, Time + noticeable gap + Small Blue ticks on right */}
        <div className="audio-time-label flex items-center justify-between text-[11px] select-none mt-1">
          <span className="text-gray-300 font-normal">
            {audioState.isPlaying || audioState.currentTime > 0
              ? formatAudioTime(audioState.currentTime)
              : formatAudioTime(audioState.duration)}
          </span>
          {formatMessageClock && msg?.createdAt && (
            <div className="flex items-center text-gray-300">
              <span>{formatMessageClock(msg.createdAt)}</span>
              <span className="ml-1.5 flex items-center">
                {renderDeliveryTicks && renderDeliveryTicks(msg, isSent, isRecipientOnline)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioMessagePlayer;
