/**
 * Core TypeScript interfaces for the meeting transcription application
 */

export interface Meeting {
  id: string; // UUID
  title: string;
  date: Date;
  duration: number; // seconds
  audioBlob: Blob; // webm audio file
  transcript: string;
  summary?: Summary;
  speakers: Speaker[];
  tags: string[];
  category: string;
  archived: boolean; // if true, audioBlob deleted to save space
  createdAt: Date;
  updatedAt: Date;
}

export interface Summary {
  executive: string; // 2-3 paragraph summary
  keyPoints: string[]; // 5-7 bullet points
  actionItems: ActionItem[];
  decisions: string[];
  questions: string[]; // Open items
  category: string; // standup, planning, client call, etc.
  tags: string[]; // Auto-generated tags
  generatedAt: Date;
  model: 'haiku' | 'sonnet'; // Claude model used
}

export interface ActionItem {
  task: string;
  owner: string;
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface Speaker {
  id: string;
  name: string; // editable, default "Speaker 1"
  color: string; // hex color for UI
}

export interface CostTracking {
  month: string; // "2025-10"
  transcriptionCost: number;
  summarizationCost: number;
  meetingCount: number;
  totalCost: number;
  lastUpdated: Date;
}

// For serialization to IndexedDB (Dates become strings)
export interface MeetingDB {
  id: string;
  title: string;
  date: string; // ISO string
  duration: number;
  audioBlob: Blob | null; // null if archived
  transcript: string;
  summary?: SummaryDB;
  speakers: Speaker[];
  tags: string[];
  category: string;
  archived: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface SummaryDB {
  executive: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  questions: string[];
  category: string;
  tags: string[];
  generatedAt: string; // ISO string
  model: 'haiku' | 'sonnet';
}

export interface CostTrackingDB {
  month: string;
  transcriptionCost: number;
  summarizationCost: number;
  meetingCount: number;
  totalCost: number;
  lastUpdated: string; // ISO string
}

// Recording state
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // seconds
  audioLevel: number; // 0-100 for visualization
}

// Storage info
export interface StorageInfo {
  used: number; // bytes
  quota: number; // bytes
  percentage: number; // 0-100
}

// Whisper API response
export interface WhisperResponse {
  text: string;
  segments?: WhisperSegment[];
}

export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

// Claude API structured response
export interface ClaudeSummaryResponse {
  executive: string;
  keyPoints: string[];
  actionItems: {
    task: string;
    owner: string;
    deadline?: string;
    priority?: 'high' | 'medium' | 'low';
  }[];
  decisions: string[];
  questions: string[];
  category: string;
  tags: string[];
}

// Export format
export interface ExportedMeeting {
  metadata: {
    id: string;
    title: string;
    date: string;
    duration: number;
    speakers: Speaker[];
    tags: string[];
    category: string;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
  };
  transcript: string;
  summary?: SummaryDB;
  hasAudio: boolean;
}

// Settings
export interface AppSettings {
  darkMode: boolean;
  autoArchiveDays: number | null; // null = disabled
  autoDeleteArchivedDays: number | null; // null = disabled
  defaultMeetingTitleFormat: string; // e.g., "Meeting - {date}"
  preferredModel: 'haiku' | 'sonnet';
  enablePromptCaching: boolean;
  language: string;
}

// Toast notification types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds
}
