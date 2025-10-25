/**
 * useRecorder Hook
 * Manages audio recording state and operations
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder } from '@/lib/audio';

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize recorder
  const initialize = useCallback(async () => {
    try {
      setError(null);
      const recorder = new AudioRecorder();
      await recorder.initialize();
      recorderRef.current = recorder;
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize recorder';
      setError(errorMessage);
      return false;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      if (!recorderRef.current) {
        const initialized = await initialize();
        if (!initialized) return;
      }

      recorderRef.current?.start({
        onAudioLevel: (level) => setAudioLevel(level),
      });

      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Update duration every 100ms
      intervalRef.current = setInterval(() => {
        if (recorderRef.current) {
          setDuration(recorderRef.current.getDuration());
        }
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
    }
  }, [initialize]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    recorderRef.current?.pause();
    setIsPaused(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    recorderRef.current?.resume();
    setIsPaused(false);

    // Restart duration updates
    intervalRef.current = setInterval(() => {
      if (recorderRef.current) {
        setDuration(recorderRef.current.getDuration());
      }
    }, 100);
  }, []);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    try {
      if (!recorderRef.current) return null;

      const blob = await recorderRef.current.stop();

      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      return blob;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
      return null;
    }
  }, []);

  // Get frequency data for visualization
  const getFrequencyData = useCallback((): Uint8Array => {
    return recorderRef.current?.getFrequencyData() || new Uint8Array(0);
  }, []);

  // Get time domain data for waveform
  const getTimeDomainData = useCallback((): Uint8Array => {
    return recorderRef.current?.getTimeDomainData() || new Uint8Array(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (recorderRef.current) {
        recorderRef.current.cleanup();
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    getFrequencyData,
    getTimeDomainData,
  };
}
