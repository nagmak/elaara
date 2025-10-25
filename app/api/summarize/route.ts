/**
 * API Route: /api/summarize
 * Handles meeting summarization using Claude API with prompt caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { summarizeTranscript } from '@/lib/claude';
import { calculateSummarizationCost, estimateSummarizationCost } from '@/lib/costs';

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { transcript, meetingId, model = 'haiku', useCache = true } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      );
    }

    if (typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Invalid transcript format' },
        { status: 400 }
      );
    }

    // Validate model
    if (model !== 'haiku' && model !== 'sonnet') {
      return NextResponse.json(
        { error: 'Invalid model. Must be "haiku" or "sonnet"' },
        { status: 400 }
      );
    }

    // Estimate cost before proceeding
    const estimatedCost = estimateSummarizationCost(transcript, model, useCache);

    // Generate summary
    const summary = await summarizeTranscript(transcript, apiKey, {
      model,
      useCache,
    });

    // Calculate actual cost
    // Note: In production, you'd want to extract actual token usage from the API response
    // For now, we'll use the estimate
    const cost = estimatedCost;

    // Return summary with cost info
    return NextResponse.json({
      success: true,
      summary,
      cost, // For internal tracking
      meetingId,
    });
  } catch (error) {
    console.error('Summarization error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: `Summarization failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Configure API route
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max
