import { useState, useRef, useEffect, useCallback } from "react";

export const formatAudioTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Hook for managing multiple in-chat audio player widgets and waveform scrubbing
 */
export const useAudioPlayback = () => {
  const [audioPlaybackState, setAudioPlaybackState] = useState({});
  const activeAudioRefs = useRef({});

  // Clean up all audio players on unmount
  useEffect(() => {
    const audioInstances = activeAudioRefs.current;
    return () => {
      Object.values(audioInstances).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, []);

  const toggleAudioPlay = useCallback((messageId, audioUrl) => {
    let audio = activeAudioRefs.current[messageId];

    if (!audio) {
      audio = new Audio(audioUrl);
      activeAudioRefs.current[messageId] = audio;

      audio.onloadedmetadata = () => {
        setAudioPlaybackState((prev) => ({
          ...prev,
          [messageId]: {
            isPlaying: false,
            currentTime: 0,
            duration: audio.duration || 0,
          },
        }));
      };

      audio.ontimeupdate = () => {
        setAudioPlaybackState((prev) => ({
          ...prev,
          [messageId]: {
            isPlaying: !audio.paused,
            currentTime: audio.currentTime,
            duration: audio.duration || 0,
          },
        }));
      };

      audio.onended = () => {
        setAudioPlaybackState((prev) => ({
          ...prev,
          [messageId]: {
            isPlaying: false,
            currentTime: 0,
            duration: audio.duration || 0,
          },
        }));
      };
    }

    if (audio.paused) {
      // Pause all other audio players to ensure only one plays at a time
      Object.entries(activeAudioRefs.current).forEach(([id, otherAudio]) => {
        if (id !== messageId && otherAudio && !otherAudio.paused) {
          otherAudio.pause();
          setAudioPlaybackState((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              isPlaying: false,
            },
          }));
        }
      });

      audio.play().catch(() => {});
      setAudioPlaybackState((prev) => ({
        ...prev,
        [messageId]: {
          isPlaying: true,
          currentTime: audio.currentTime,
          duration: audio.duration || 0,
        },
      }));
    } else {
      audio.pause();
      setAudioPlaybackState((prev) => ({
        ...prev,
        [messageId]: {
          isPlaying: false,
          currentTime: audio.currentTime,
          duration: audio.duration || 0,
        },
      }));
    }
  }, []);

  const seekAudio = useCallback((messageId, timePercent) => {
    const audio = activeAudioRefs.current[messageId];
    if (audio && audio.duration) {
      audio.currentTime = timePercent * audio.duration;
    }
  }, []);

  return {
    audioPlaybackState,
    toggleAudioPlay,
    seekAudio,
    formatAudioTime,
  };
};
