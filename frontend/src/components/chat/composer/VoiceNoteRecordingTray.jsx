import React from "react";
import { formatAudioTime } from "../hooks/useAudioPlayback";

const VoiceNoteRecordingTray = ({
  isRecording,
  recordingSeconds = 0,
  onCancel,
  onStopAndSend,
}) => {
  if (!isRecording) return null;

  return (
    <div className="voice-record-tray flex items-center justify-between px-4 py-3 bg-slate-900 border-t border-violet-500/30">
      <div className="flex items-center gap-3">
        <div className="voice-record-pulse" />
        <span className="text-sm font-semibold text-red-400">Recording</span>
        <span className="text-sm text-gray-300 font-mono">
          {formatAudioTime(recordingSeconds)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-red-500/10 transition-colors cursor-pointer"
          title="Cancel recording"
        >
          <span className="material-icons text-xl">delete</span>
        </button>
        <button
          type="button"
          onClick={onStopAndSend}
          className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-full transition-colors cursor-pointer shadow-md"
          title="Send voice note"
        >
          <span className="material-icons text-xl">send</span>
        </button>
      </div>
    </div>
  );
};

export default VoiceNoteRecordingTray;
