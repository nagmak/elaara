/**
 * Anthropic Claude API client for meeting summarization
 * Implements prompt caching for 50% cost savings
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeSummaryResponse } from './types';
import { preprocessTranscript } from './preprocessing';

// System prompt for summarization (will be cached)
const SUMMARIZATION_SYSTEM_PROMPT = `You are a meeting summarization assistant. Analyze the following meeting transcript and provide a structured summary in JSON format.

Your response must be valid JSON with the following structure:
{
  "executive": "2-3 paragraph summary describing the meeting's purpose and outcomes",
  "keyPoints": ["array", "of", "5-7", "most", "important", "discussion", "points"],
  "actionItems": [
    {
      "task": "Description of the task",
      "owner": "Person responsible (or 'TBD' if not specified)",
      "deadline": "Deadline if mentioned (optional)",
      "priority": "high|medium|low (optional)"
    }
  ],
  "decisions": ["array", "of", "clear", "decisions", "reached"],
  "questions": ["array", "of", "unresolved", "questions", "or", "topics", "for", "follow-up"],
  "category": "Choose one: standup, planning, client_call, lecture, brainstorm, review, interview, other",
  "tags": ["array", "of", "3-5", "relevant", "keywords"]
}

Guidelines:
- Be concise, accurate, and focus on actionable information
- Extract specific action items with owners when mentioned
- Identify concrete decisions that were made
- Note questions or topics that remain unresolved
- Choose the most appropriate category for the meeting type
- Generate relevant tags that would help organize this meeting

Return ONLY valid JSON, no additional text.`;

/**
 * Summarize a meeting transcript using Claude API
 * @param transcript - The meeting transcript
 * @param apiKey - Anthropic API key
 * @param options - Summarization options
 * @returns Structured summary
 */
export async function summarizeTranscript(
  transcript: string,
  apiKey: string,
  options: {
    model?: 'haiku' | 'sonnet';
    useCache?: boolean;
    onProgress?: (status: string) => void;
  } = {}
): Promise<ClaudeSummaryResponse> {
  const model = options.model || 'haiku';
  const useCache = options.useCache !== false; // Default true

  // Preprocess transcript to reduce tokens
  const processedTranscript = preprocessTranscript(transcript);

  if (options.onProgress) {
    options.onProgress('Preprocessing transcript...');
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage
  });

  try {
    if (options.onProgress) {
      options.onProgress('Generating summary...');
    }

    // Determine model name
    const modelName =
      model === 'haiku'
        ? 'claude-3-5-haiku-20241022'
        : 'claude-3-5-sonnet-20241022';

    // Build messages with prompt caching
    const systemMessage: Anthropic.Messages.MessageParam[] = useCache
      ? [
          {
            type: 'text',
            text: SUMMARIZATION_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          } as any,
        ]
      : [
          {
            type: 'text',
            text: SUMMARIZATION_SYSTEM_PROMPT,
          } as any,
        ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 2000,
      system: systemMessage as any,
      messages: [
        {
          role: 'user',
          content: processedTranscript,
        },
      ],
    });

    if (options.onProgress) {
      options.onProgress('Parsing response...');
    }

    // Extract text from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    let responseText = content.text;

    // Sometimes Claude wraps JSON in markdown code blocks - remove them
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Parse JSON response
    let summary: ClaudeSummaryResponse;
    try {
      summary = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      throw new Error('Failed to parse summary response. Please try again.');
    }

    // Validate response structure
    validateSummaryResponse(summary);

    if (options.onProgress) {
      options.onProgress('Summary complete!');
    }

    return summary;
  } catch (error) {
    // Handle API errors
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Claude API error: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Validate that the summary response has the expected structure
 */
function validateSummaryResponse(summary: any): asserts summary is ClaudeSummaryResponse {
  if (!summary || typeof summary !== 'object') {
    throw new Error('Invalid summary response: not an object');
  }

  if (typeof summary.executive !== 'string') {
    throw new Error('Invalid summary response: missing or invalid "executive" field');
  }

  if (!Array.isArray(summary.keyPoints)) {
    throw new Error('Invalid summary response: missing or invalid "keyPoints" field');
  }

  if (!Array.isArray(summary.actionItems)) {
    throw new Error('Invalid summary response: missing or invalid "actionItems" field');
  }

  if (!Array.isArray(summary.decisions)) {
    throw new Error('Invalid summary response: missing or invalid "decisions" field');
  }

  if (!Array.isArray(summary.questions)) {
    throw new Error('Invalid summary response: missing or invalid "questions" field');
  }

  if (typeof summary.category !== 'string') {
    throw new Error('Invalid summary response: missing or invalid "category" field');
  }

  if (!Array.isArray(summary.tags)) {
    throw new Error('Invalid summary response: missing or invalid "tags" field');
  }

  // Validate action items structure
  for (const item of summary.actionItems) {
    if (typeof item.task !== 'string' || typeof item.owner !== 'string') {
      throw new Error('Invalid action item structure');
    }
  }
}

/**
 * Get usage statistics from Claude API response
 * (For cost tracking purposes)
 */
export interface ClaudeUsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Extract usage statistics from Claude API response
 * This is typically available in the response metadata
 */
export function extractUsageStats(response: any): ClaudeUsageStats {
  return {
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    cacheCreationTokens: response.usage?.cache_creation_input_tokens || 0,
    cacheReadTokens: response.usage?.cache_read_input_tokens || 0,
  };
}

/**
 * Regenerate summary with different parameters
 */
export async function regenerateSummary(
  transcript: string,
  apiKey: string,
  options: {
    model?: 'haiku' | 'sonnet';
    focusAreas?: string[]; // Specific areas to focus on
    onProgress?: (status: string) => void;
  } = {}
): Promise<ClaudeSummaryResponse> {
  let modifiedPrompt = SUMMARIZATION_SYSTEM_PROMPT;

  // Add focus areas if specified
  if (options.focusAreas && options.focusAreas.length > 0) {
    modifiedPrompt += `\n\nPay special attention to: ${options.focusAreas.join(', ')}`;
  }

  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const processedTranscript = preprocessTranscript(transcript);

  const modelName =
    options.model === 'sonnet'
      ? 'claude-3-5-sonnet-20241022'
      : 'claude-3-5-haiku-20241022';

  const response = await anthropic.messages.create({
    model: modelName,
    max_tokens: 2000,
    system: modifiedPrompt,
    messages: [
      {
        role: 'user',
        content: processedTranscript,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  let responseText = content.text;
  responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  const summary: ClaudeSummaryResponse = JSON.parse(responseText);
  validateSummaryResponse(summary);

  return summary;
}

/**
 * Test Claude API connection
 */
export async function testClaudeConnection(apiKey: string): Promise<boolean> {
  try {
    const anthropic = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    // Make a minimal test request
    await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    });

    return true;
  } catch {
    return false;
  }
}
