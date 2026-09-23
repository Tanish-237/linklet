import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook for managing audio voice note recording with MediaRecorder
 * @param {Function} onAudioReady Callback called with recorded Audio File when recording finishes
 */
export const useVoiceRecorder = (onAudioReady) => {
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const onAudioReadyRef = useRef(onAudioReady);

  useEffect(() => {
    onAudioReadyRef.current = onAudioReady;
  }, [onAudioReady]);

  // Clean up timers and audio streams on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecordingAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length > 0 && !mediaRecorderRef.current?.cancelled) {
          const audioFile = new File([audioBlob], `voicenote_${Date.now()}.webm`, {
            type: "audio/webm",
          });
          if (onAudioReadyRef.current) {
            onAudioReadyRef.current(audioFile);
          }
        }
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      toast.error("Microphone access denied or unavailable");
    }
  }, []);

  const stopAndSendAudio = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.cancelled = false;
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
    }
  }, [isRecordingAudio]);

  const cancelRecordingAudio = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.cancelled = true;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
    }
  }, [isRecordingAudio]);

  return {
    isRecordingAudio,
    recordingSeconds,
    startRecordingAudio,
    stopAndSendAudio,
    cancelRecordingAudio,
  };
};
