/**
 * API Route: /api/transcribe
 * Handles audio transcription using OpenAI Whisper API
 */

import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio, chunkAudioFile, transcribeChunkedAudio } from '@/lib/whisper';
import { calculateTranscriptionCost } from '@/lib/costs';

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string | null;
    const meetingId = formData.get('meetingId') as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Convert File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], {
      type: audioFile.type,
    });

    // Get audio duration (approximate from file size)
    // Note: More accurate with actual audio metadata parsing
    const durationSeconds = estimateDuration(audioBlob.size);

    // Check if file needs chunking (>25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    let transcription;

    if (audioBlob.size > MAX_SIZE) {
      // Chunk and transcribe
      const chunks = await chunkAudioFile(audioBlob);
      transcription = await transcribeChunkedAudio(chunks, apiKey, {
        language: language || undefined,
      });
    } else {
      // Transcribe directly
      transcription = await transcribeAudio(audioBlob, apiKey, {
        language: language || undefined,
      });
    }

    // Calculate cost (silent backend tracking)
    const cost = calculateTranscriptionCost(durationSeconds);

    // Return transcription result
    return NextResponse.json({
      success: true,
      transcript: transcription.text,
      segments: transcription.segments,
      duration: durationSeconds,
      cost, // For internal tracking
      meetingId,
    });
  } catch (error) {
    console.error('Transcription error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: `Transcription failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * Estimate audio duration from file size
 * This is a rough approximation - actual duration may vary
 * @param sizeBytes - File size in bytes
 * @returns Estimated duration in seconds
 */
function estimateDuration(sizeBytes: number): number {
  // Rough estimate: 1 MB ≈ 60 seconds of audio at typical quality
  // Adjust based on actual encoding
  const mbSize = sizeBytes / (1024 * 1024);
  return Math.ceil(mbSize * 60);
}

// Configure API route
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max
