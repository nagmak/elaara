/**
 * Transcript preprocessing utilities for cost optimization
 * Reduces token count by 30-40% before sending to AI APIs
 */

/**
 * Preprocess transcript to reduce token count while maintaining meaning
 * - Removes timestamps
 * - Removes speaker labels
 * - Collapses whitespace
 * - Removes word repetitions (stutters, etc.)
 */
export function preprocessTranscript(transcript: string): string {
  return transcript
    // Remove timestamps in format [HH:MM:SS] or [MM:SS]
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '')
    // Remove speaker labels (e.g., "Speaker 1:", "John:", etc.)
    .replace(/^(?:Speaker \d+|[\w\s]+):\s*/gm, '')
    // Collapse multiple whitespace characters into single space
    .replace(/\s+/g, ' ')
    // Remove word repetitions (e.g., "I I I think" -> "I think")
    .replace(/(\b\w+\b)(\s+\1\b)+/gi, '$1')
    // Remove common filler words in clusters
    .replace(/\b(um|uh|er|ah|like|you know)\b\s*/gi, '')
    // Trim leading and trailing whitespace
    .trim();
}

/**
 * Add timestamps to transcript for display purposes
 * Converts seconds to [HH:MM:SS] format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `[${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  }

  return `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
}

/**
 * Parse timestamp from string format back to seconds
 */
export function parseTimestamp(timestamp: string): number {
  const match = timestamp.match(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/);

  if (!match) return 0;

  const hours = match[3] ? parseInt(match[1]) : 0;
  const minutes = match[3] ? parseInt(match[2]) : parseInt(match[1]);
  const seconds = match[3] ? parseInt(match[3]) : parseInt(match[2]);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Split transcript into chunks for processing (if needed for large files)
 * Ensures chunks don't exceed max token limit
 */
export function chunkTranscript(
  transcript: string,
  maxTokens: number = 100000
): string[] {
  // Rough estimate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;

  if (transcript.length <= maxChars) {
    return [transcript];
  }

  const chunks: string[] = [];
  const sentences = transcript.split(/[.!?]+\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Estimate token count for a text string
 * Uses rough approximation: 1 token ≈ 4 characters
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate percentage reduction from preprocessing
 */
export function calculateReduction(original: string, processed: string): number {
  const originalTokens = estimateTokenCount(original);
  const processedTokens = estimateTokenCount(processed);
  return ((originalTokens - processedTokens) / originalTokens) * 100;
}

/**
 * Format transcript with speaker labels and timestamps for display
 */
export function formatTranscriptForDisplay(
  transcript: string,
  speakers: { id: string; name: string; color: string }[]
): string {
  // This is a placeholder - actual formatting will be done in the component
  // based on the parsed Whisper segments
  return transcript;
}

/**
 * Clean up transcript for export (removes excessive whitespace, normalizes formatting)
 */
export function cleanTranscriptForExport(transcript: string): string {
  return transcript
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    // Remove multiple consecutive blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Trim the whole thing
    .trim();
}
