/**
 * Cost tracking and estimation utilities
 * Runs in background - minimal UI display by design
 */

import { updateCostTracking } from './db';
import { estimateTokenCount } from './preprocessing';

// OpenAI Whisper API pricing (as of 2025)
const WHISPER_COST_PER_MINUTE = 0.006; // $0.006 per minute

// Anthropic Claude API pricing (as of 2025)
const CLAUDE_HAIKU_INPUT_COST_PER_MILLION = 0.25; // $0.25 per million input tokens
const CLAUDE_HAIKU_OUTPUT_COST_PER_MILLION = 1.25; // $1.25 per million output tokens
const CLAUDE_SONNET_INPUT_COST_PER_MILLION = 3.0; // $3.00 per million input tokens
const CLAUDE_SONNET_OUTPUT_COST_PER_MILLION = 15.0; // $15.00 per million output tokens

// Prompt caching discount (50% off cached tokens)
const PROMPT_CACHE_DISCOUNT = 0.5;

/**
 * Estimate transcription cost based on audio duration
 * @param durationMinutes - Audio duration in minutes
 * @returns Estimated cost in dollars
 */
export function estimateTranscriptionCost(durationMinutes: number): number {
  return durationMinutes * WHISPER_COST_PER_MINUTE;
}

/**
 * Calculate actual transcription cost
 * @param durationSeconds - Audio duration in seconds
 * @returns Cost in dollars
 */
export function calculateTranscriptionCost(durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60;
  return estimateTranscriptionCost(durationMinutes);
}

/**
 * Estimate summarization cost based on transcript text
 * @param transcript - The transcript text
 * @param model - Claude model to use ('haiku' or 'sonnet')
 * @param useCache - Whether prompt caching is enabled
 * @returns Estimated cost in dollars
 */
export function estimateSummarizationCost(
  transcript: string,
  model: 'haiku' | 'sonnet' = 'haiku',
  useCache: boolean = true
): number {
  const inputTokens = estimateTokenCount(transcript);
  const estimatedOutputTokens = 1000; // Approximate summary length

  // System prompt tokens (these will be cached)
  const systemPromptTokens = 250; // Approximate

  // Select pricing based on model
  const inputCostPerMillion = model === 'haiku'
    ? CLAUDE_HAIKU_INPUT_COST_PER_MILLION
    : CLAUDE_SONNET_INPUT_COST_PER_MILLION;

  const outputCostPerMillion = model === 'haiku'
    ? CLAUDE_HAIKU_OUTPUT_COST_PER_MILLION
    : CLAUDE_SONNET_OUTPUT_COST_PER_MILLION;

  // Calculate costs
  let inputCost = (inputTokens / 1_000_000) * inputCostPerMillion;

  // Apply cache discount to system prompt tokens
  if (useCache) {
    const cachedCost = (systemPromptTokens / 1_000_000) * inputCostPerMillion * PROMPT_CACHE_DISCOUNT;
    const uncachedCost = ((inputTokens - systemPromptTokens) / 1_000_000) * inputCostPerMillion;
    inputCost = cachedCost + uncachedCost;
  }

  const outputCost = (estimatedOutputTokens / 1_000_000) * outputCostPerMillion;

  return inputCost + outputCost;
}

/**
 * Calculate actual summarization cost after API call
 * @param inputTokens - Actual input tokens used
 * @param outputTokens - Actual output tokens used
 * @param model - Claude model used
 * @param cachedTokens - Number of tokens that were cached
 * @returns Cost in dollars
 */
export function calculateSummarizationCost(
  inputTokens: number,
  outputTokens: number,
  model: 'haiku' | 'sonnet' = 'haiku',
  cachedTokens: number = 0
): number {
  const inputCostPerMillion = model === 'haiku'
    ? CLAUDE_HAIKU_INPUT_COST_PER_MILLION
    : CLAUDE_SONNET_INPUT_COST_PER_MILLION;

  const outputCostPerMillion = model === 'haiku'
    ? CLAUDE_HAIKU_OUTPUT_COST_PER_MILLION
    : CLAUDE_SONNET_OUTPUT_COST_PER_MILLION;

  // Calculate cost for uncached input tokens
  const uncachedTokens = inputTokens - cachedTokens;
  const uncachedCost = (uncachedTokens / 1_000_000) * inputCostPerMillion;

  // Calculate cost for cached tokens (50% discount)
  const cachedCost = (cachedTokens / 1_000_000) * inputCostPerMillion * PROMPT_CACHE_DISCOUNT;

  // Calculate output cost
  const outputCost = (outputTokens / 1_000_000) * outputCostPerMillion;

  return uncachedCost + cachedCost + outputCost;
}

/**
 * Log cost for a meeting (silently updates IndexedDB)
 * No UI updates - runs in background
 * @param meetingId - Meeting ID
 * @param type - Type of operation ('transcription' or 'summarization')
 * @param amount - Cost amount in dollars
 */
export async function logCost(
  meetingId: string,
  type: 'transcription' | 'summarization',
  amount: number
): Promise<void> {
  try {
    // Get current month in YYYY-MM format
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Update cost tracking in database
    const transcriptionCost = type === 'transcription' ? amount : 0;
    const summarizationCost = type === 'summarization' ? amount : 0;

    await updateCostTracking(month, transcriptionCost, summarizationCost);

    // Silent logging - no UI feedback
    console.debug(`[Cost Tracking] ${type}: $${amount.toFixed(4)} for meeting ${meetingId}`);
  } catch (error) {
    // Fail silently - cost tracking should never break the app
    console.error('[Cost Tracking] Failed to log cost:', error);
  }
}

/**
 * Format cost for display
 * @param cost - Cost in dollars
 * @returns Formatted string (e.g., "$0.05" or "$1.23")
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return '<$0.01';
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get estimated cost savings from using Haiku vs Sonnet
 * @param transcript - The transcript text
 * @returns Savings amount in dollars
 */
export function calculateSavingsFromHaiku(transcript: string): number {
  const haikuCost = estimateSummarizationCost(transcript, 'haiku');
  const sonnetCost = estimateSummarizationCost(transcript, 'sonnet');
  return sonnetCost - haikuCost;
}

/**
 * Get estimated cost savings from prompt caching
 * @param transcript - The transcript text
 * @param model - Claude model
 * @returns Savings amount in dollars
 */
export function calculateSavingsFromCaching(
  transcript: string,
  model: 'haiku' | 'sonnet' = 'haiku'
): number {
  const withCache = estimateSummarizationCost(transcript, model, true);
  const withoutCache = estimateSummarizationCost(transcript, model, false);
  return withoutCache - withCache;
}

/**
 * Get total estimated cost for a meeting
 * @param durationSeconds - Audio duration
 * @param transcriptLength - Transcript character count
 * @param includeSummary - Whether to include summarization cost
 * @returns Total cost object with breakdown
 */
export function estimateTotalMeetingCost(
  durationSeconds: number,
  transcriptLength: number = 0,
  includeSummary: boolean = false
): {
  transcription: number;
  summarization: number;
  total: number;
} {
  const transcription = calculateTranscriptionCost(durationSeconds);

  let summarization = 0;
  if (includeSummary && transcriptLength > 0) {
    // Create a dummy transcript of the right length for estimation
    const dummyTranscript = 'x'.repeat(transcriptLength);
    summarization = estimateSummarizationCost(dummyTranscript, 'haiku', true);
  }

  return {
    transcription,
    summarization,
    total: transcription + summarization,
  };
}

/**
 * Check if cost tracking should show a warning
 * (Only used in Advanced Settings if user checks)
 * @param monthlyCost - Total cost for the month
 * @returns Warning level: 'none', 'low', 'medium', 'high'
 */
export function getCostWarningLevel(monthlyCost: number): 'none' | 'low' | 'medium' | 'high' {
  if (monthlyCost < 5) return 'none';
  if (monthlyCost < 15) return 'low';
  if (monthlyCost < 30) return 'medium';
  return 'high';
}
