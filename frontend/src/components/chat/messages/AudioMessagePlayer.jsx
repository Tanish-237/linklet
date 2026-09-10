import React from "react";
import { formatAudioTime } from "../hooks/useAudioPlayback";

const AudioMessagePlayer = ({
  messageId,
  audioUrl,
  audioState = { isPlaying: false, currentTime: 0, duration: 0 },
  onTogglePlay,
  onSeek,
}) => {
  const percent = audioState.duration
    ? (audioState.currentTime / audioState.duration) * 100
    : 0;

  return (
    <div className="audio-player-widget">
      <button
        type="button"
        onClick={() => onTogglePlay(messageId, audioUrl)}
        className="audio-play-btn"
        aria-label={audioState.isPlaying ? "Pause voice note" : "Play voice note"}
      >
        <span className="material-icons text-xl">
          {audioState.isPlaying ? "pause" : "play_arrow"}
        </span>
      </button>

      <div className="audio-progress-container">
        <div
          className="audio-progress-bar"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (onSeek) onSeek(messageId, pos);
          }}
        >
          <div
            className="audio-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="audio-time-label">
          <span>{formatAudioTime(audioState.currentTime)}</span>
          <span>{formatAudioTime(audioState.duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioMessagePlayer;
