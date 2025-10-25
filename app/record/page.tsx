'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRecorder } from '@/hooks/useRecorder';
import { useToast } from '@/hooks/useToast';
import { saveMeeting } from '@/lib/db';
import { formatDuration } from '@/lib/audio';
import { generateId, generateMeetingTitle, generateSpeakerColor } from '@/lib/utils';
import { logCost } from '@/lib/costs';
import type { Meeting, Speaker } from '@/lib/types';

export default function RecordPage() {
  const router = useRouter();
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useRecorder();
  const { success, error: showError } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

  // Show error if recording fails
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  const handleStart = async () => {
    await startRecording();
  };

  const handlePause = () => {
    pauseRecording();
  };

  const handleResume = () => {
    resumeRecording();
  };

  const handleStop = async () => {
    const audioBlob = await stopRecording();

    if (!audioBlob) {
      showError('Failed to save recording');
      return;
    }

    setIsProcessing(true);

    try {
      // Create meeting ID
      const meetingId = generateId();

      // Transcribe audio
      setTranscribing(true);
      setTranscriptionProgress(10);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('meetingId', meetingId);

      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error('Transcription failed');
      }

      setTranscriptionProgress(50);

      const transcribeData = await transcribeResponse.json();

      setTranscriptionProgress(90);

      // Log transcription cost (silent)
      if (transcribeData.cost) {
        await logCost(meetingId, 'transcription', transcribeData.cost);
      }

      // Detect speakers (basic implementation)
      const speakers: Speaker[] = [
        {
          id: 'speaker-1',
          name: 'Speaker 1',
          color: generateSpeakerColor(0),
        },
      ];

      // Create meeting object
      const meeting: Meeting = {
        id: meetingId,
        title: generateMeetingTitle(),
        date: new Date(),
        duration: Math.floor(duration),
        audioBlob,
        transcript: transcribeData.transcript,
        summary: undefined,
        speakers,
        tags: [],
        category: 'other',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to IndexedDB
      await saveMeeting(meeting);

      setTranscriptionProgress(100);
      success('Meeting saved successfully!');

      // Redirect to meeting detail page
      router.push(`/meeting/${meetingId}`);
    } catch (err) {
      console.error('Failed to process recording:', err);
      showError('Failed to process recording. Please try again.');
      setIsProcessing(false);
      setTranscribing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isRecording ? 'Recording...' : 'Start Recording'}
        </h1>

        {/* Recording Button */}
        <div className="flex justify-center">
          {!isRecording ? (
            <button
              onClick={handleStart}
              disabled={isProcessing}
              className="w-32 h-32 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
            </button>
          ) : (
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-red-500 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-red-600 animate-pulse-recording" />
              </div>
              {/* Audio level indicator */}
              <div className="absolute -bottom-4 left-0 right-0">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-100"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Duration Display */}
        {isRecording && (
          <div className="text-4xl font-mono font-bold text-gray-900 dark:text-gray-100">
            {formatDuration(duration)}
          </div>
        )}

        {/* Control Buttons */}
        {isRecording && (
          <div className="flex justify-center gap-4">
            {!isPaused ? (
              <button
                onClick={handlePause}
                className="btn btn-secondary px-8"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="btn btn-primary px-8"
              >
                Resume
              </button>
            )}

            <button
              onClick={handleStop}
              className="btn btn-danger px-8"
            >
              Stop & Save
            </button>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="card p-8 mt-8">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="spinner" />
              </div>

              {transcribing && (
                <>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    Transcribing meeting... {transcriptionProgress}%
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${transcriptionProgress}%` }}
                    />
                  </div>
                </>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please wait while we process your recording...
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isRecording && !isProcessing && (
          <div className="card p-6 text-left">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Recording Tips
            </h2>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Make sure your microphone is properly connected
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Choose a quiet environment for better transcription
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Click Stop & Save when finished to transcribe your meeting
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                All data is stored locally in your browser
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
