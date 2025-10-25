/**
 * OpenAI Whisper API client for speech transcription
 * Handles audio transcription with timestamps and speaker detection
 */

import OpenAI from 'openai';
import type { WhisperResponse } from './types';

// Maximum file size for Whisper API (25MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Transcribe audio using OpenAI Whisper API
 * @param audioBlob - The audio blob to transcribe
 * @param apiKey - OpenAI API key
 * @param options - Transcription options
 * @returns Transcription result with text and timestamps
 */
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  options: {
    language?: string;
    prompt?: string;
    temperature?: number;
    onProgress?: (progress: number) => void;
  } = {}
): Promise<WhisperResponse> {
  // Validate file size
  if (audioBlob.size > MAX_FILE_SIZE) {
    throw new Error(
      `Audio file is too large (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 25MB.`
    );
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage
  });

  try {
    // Convert blob to File object (required by OpenAI SDK)
    const audioFile = new File([audioBlob], 'recording.webm', {
      type: audioBlob.type || 'audio/webm',
    });

    // Report initial progress
    if (options.onProgress) {
      options.onProgress(10);
    }

    // Call Whisper API with verbose JSON to get timestamps
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: options.language,
      prompt: options.prompt,
      temperature: options.temperature || 0,
      response_format: 'verbose_json', // Get timestamps
    });

    // Report completion
    if (options.onProgress) {
      options.onProgress(100);
    }

    // Type guard to check if we have verbose response
    if ('segments' in transcription) {
      return {
        text: transcription.text,
        segments: transcription.segments || [],
      };
    }

    // Fallback if only text is returned
    return {
      text: transcription.text,
      segments: [],
    };
  } catch (error) {
    // Handle API errors
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Whisper API error: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Chunk large audio files for processing
 * (Note: Whisper API has 25MB limit, so we may need to split long recordings)
 * @param audioBlob - The audio blob to chunk
 * @param chunkSizeBytes - Maximum chunk size in bytes
 * @returns Array of audio blob chunks
 */
export async function chunkAudioFile(
  audioBlob: Blob,
  chunkSizeBytes: number = MAX_FILE_SIZE * 0.9 // 90% of max to be safe
): Promise<Blob[]> {
  // For now, we'll implement a simple chunking strategy
  // In a production app, you'd want to use FFmpeg or similar to properly split audio

  if (audioBlob.size <= chunkSizeBytes) {
    return [audioBlob];
  }

  // Calculate number of chunks needed
  const numChunks = Math.ceil(audioBlob.size / chunkSizeBytes);
  const chunks: Blob[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSizeBytes;
    const end = Math.min(start + chunkSizeBytes, audioBlob.size);
    const chunk = audioBlob.slice(start, end, audioBlob.type);
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Process multiple audio chunks and combine transcripts
 * @param chunks - Array of audio blobs to process
 * @param apiKey - OpenAI API key
 * @param options - Transcription options
 * @returns Combined transcription result
 */
export async function transcribeChunkedAudio(
  chunks: Blob[],
  apiKey: string,
  options: {
    language?: string;
    prompt?: string;
    onProgress?: (progress: number, current: number, total: number) => void;
  } = {}
): Promise<WhisperResponse> {
  const results: WhisperResponse[] = [];
  let cumulativeTime = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Transcribe chunk
    const result = await transcribeAudio(chunk, apiKey, {
      language: options.language,
      prompt: options.prompt,
      onProgress: (chunkProgress) => {
        // Calculate overall progress
        const overallProgress =
          ((i + chunkProgress / 100) / chunks.length) * 100;
        if (options.onProgress) {
          options.onProgress(overallProgress, i + 1, chunks.length);
        }
      },
    });

    // Adjust timestamps for this chunk
    if (result.segments) {
      result.segments = result.segments.map((segment) => ({
        ...segment,
        start: segment.start + cumulativeTime,
        end: segment.end + cumulativeTime,
      }));

      // Update cumulative time for next chunk
      const lastSegment = result.segments[result.segments.length - 1];
      if (lastSegment) {
        cumulativeTime = lastSegment.end;
      }
    }

    results.push(result);
  }

  // Combine all results
  const combinedText = results.map((r) => r.text).join(' ');
  const combinedSegments = results.flatMap((r) => r.segments || []);

  return {
    text: combinedText,
    segments: combinedSegments,
  };
}

/**
 * Format transcription with timestamps for display
 * @param transcription - Whisper API response
 * @returns Formatted transcript with timestamps
 */
export function formatTranscriptWithTimestamps(
  transcription: WhisperResponse
): string {
  if (!transcription.segments || transcription.segments.length === 0) {
    return transcription.text;
  }

  return transcription.segments
    .map((segment) => {
      const timestamp = formatTimestamp(segment.start);
      return `${timestamp} ${segment.text.trim()}`;
    })
    .join('\n');
}

/**
 * Format seconds to [HH:MM:SS] or [MM:SS] timestamp
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `[${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  }

  return `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
}

/**
 * Detect potential speaker changes in transcript
 * (Basic heuristic - looks for pauses and punctuation)
 * @param segments - Whisper segments
 * @returns Array of speaker change indices
 */
export function detectSpeakerChanges(
  segments: WhisperResponse['segments']
): number[] {
  if (!segments || segments.length === 0) {
    return [];
  }

  const changes: number[] = [0]; // First segment is always a speaker change
  const PAUSE_THRESHOLD = 1.5; // seconds

  for (let i = 1; i < segments.length; i++) {
    const prevSegment = segments[i - 1];
    const currentSegment = segments[i];

    // Check for pause between segments
    const pause = currentSegment.start - prevSegment.end;

    if (pause > PAUSE_THRESHOLD) {
      changes.push(i);
    }
  }

  return changes;
}

/**
 * Group segments by speaker (basic implementation)
 * @param segments - Whisper segments
 * @param speakerChanges - Indices where speakers change
 * @returns Segments grouped by speaker
 */
export function groupSegmentsBySpeaker(
  segments: WhisperResponse['segments'],
  speakerChanges: number[]
): Array<{
  speakerId: number;
  segments: WhisperResponse['segments'];
  text: string;
  startTime: number;
  endTime: number;
}> {
  if (!segments || segments.length === 0) {
    return [];
  }

  const grouped: Array<{
    speakerId: number;
    segments: WhisperResponse['segments'];
    text: string;
    startTime: number;
    endTime: number;
  }> = [];

  let currentSpeaker = 0;
  let currentGroup: WhisperResponse['segments'] = [];

  for (let i = 0; i < segments.length; i++) {
    if (speakerChanges.includes(i) && currentGroup.length > 0) {
      // Save current group
      const text = currentGroup.map((s) => s.text).join(' ').trim();
      grouped.push({
        speakerId: currentSpeaker,
        segments: currentGroup,
        text,
        startTime: currentGroup[0].start,
        endTime: currentGroup[currentGroup.length - 1].end,
      });

      // Start new group
      currentSpeaker++;
      currentGroup = [];
    }

    currentGroup.push(segments[i]);
  }

  // Add last group
  if (currentGroup.length > 0) {
    const text = currentGroup.map((s) => s.text).join(' ').trim();
    grouped.push({
      speakerId: currentSpeaker,
      segments: currentGroup,
      text,
      startTime: currentGroup[0].start,
      endTime: currentGroup[currentGroup.length - 1].end,
    });
  }

  return grouped;
}
