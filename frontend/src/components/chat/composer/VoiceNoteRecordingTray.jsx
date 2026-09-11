import React from "react";
import { formatAudioTime } from "../hooks/useAudioPlayback";

const VoiceNoteRecordingTray = ({
  isRecording = true,
  recordingSeconds = 0,
  onCancel,
  onCancelRecord,
  onStopAndSend,
}) => {
  if (isRecording === false) return null;

  const handleCancel = onCancel || onCancelRecord;

  return (
    <div className="voice-recording-tray flex items-center justify-between w-full min-h-[48px] px-4 py-2.5 bg-slate-900/95 border border-violet-500/30 rounded-xl shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="recording-dot-pulse flex-shrink-0" />
        <span className="text-sm font-semibold text-rose-400 select-none">
          Recording
        </span>
        <span className="text-sm text-gray-200 font-mono tracking-wider select-none">
          {formatAudioTime(recordingSeconds)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="p-2 text-gray-400 hover:text-rose-400 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
          title="Cancel recording"
          aria-label="Cancel recording"
        >
          <span className="material-icons text-xl leading-none">delete</span>
        </button>
        <button
          type="button"
          onClick={onStopAndSend}
          className="p-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white rounded-full transition-all cursor-pointer shadow-md flex items-center justify-center"
          title="Send voice note"
          aria-label="Send voice note"
        >
          <span className="material-icons text-xl leading-none">send</span>
        </button>
      </div>
    </div>
  );
};

export default VoiceNoteRecordingTray;
