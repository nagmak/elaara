/**
 * Export and import functionality for meeting backups
 * Allows users to backup and restore their data
 */

import JSZip from 'jszip';
import type { Meeting, ExportedMeeting } from './types';
import { getMeeting, getAllMeetings, saveMeeting } from './db';
import { cleanTranscriptForExport } from './preprocessing';

/**
 * Export a single meeting as a ZIP file
 * Contains: audio.webm, transcript.txt, summary.md, metadata.json
 */
export async function exportMeeting(meetingId: string): Promise<Blob> {
  const meeting = await getMeeting(meetingId);

  if (!meeting) {
    throw new Error(`Meeting with id ${meetingId} not found`);
  }

  const zip = new JSZip();

  // Add audio file (if not archived)
  if (!meeting.archived && meeting.audioBlob && meeting.audioBlob.size > 0) {
    zip.file('audio.webm', meeting.audioBlob);
  }

  // Add transcript as plain text
  const transcriptContent = cleanTranscriptForExport(meeting.transcript);
  zip.file('transcript.txt', transcriptContent);

  // Add summary as markdown (if exists)
  if (meeting.summary) {
    const summaryMarkdown = formatSummaryAsMarkdown(meeting, transcriptContent);
    zip.file('summary.md', summaryMarkdown);
  }

  // Add metadata as JSON
  const exportedMeeting: ExportedMeeting = {
    metadata: {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date.toISOString(),
      duration: meeting.duration,
      speakers: meeting.speakers,
      tags: meeting.tags,
      category: meeting.category,
      archived: meeting.archived,
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
    },
    transcript: meeting.transcript,
    summary: meeting.summary
      ? {
          ...meeting.summary,
          generatedAt: meeting.summary.generatedAt.toISOString(),
        }
      : undefined,
    hasAudio: !meeting.archived && meeting.audioBlob.size > 0,
  };

  zip.file('metadata.json', JSON.stringify(exportedMeeting, null, 2));

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Export all meetings as a comprehensive ZIP file
 * @param onProgress - Optional callback for progress updates (0-100)
 */
export async function exportAllMeetings(
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const meetings = await getAllMeetings();

  if (meetings.length === 0) {
    throw new Error('No meetings to export');
  }

  const zip = new JSZip();

  // Create a folder for each meeting
  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i];
    const progress = ((i + 1) / meetings.length) * 100;

    // Create folder name: YYYY-MM-DD_meeting-title
    const dateStr = meeting.date.toISOString().split('T')[0];
    const titleSlug = meeting.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    const folderName = `${dateStr}_${titleSlug}_${meeting.id.substring(0, 8)}`;

    const meetingFolder = zip.folder(folderName);

    if (!meetingFolder) continue;

    // Add audio file (if not archived)
    if (!meeting.archived && meeting.audioBlob && meeting.audioBlob.size > 0) {
      meetingFolder.file('audio.webm', meeting.audioBlob);
    }

    // Add transcript
    const transcriptContent = cleanTranscriptForExport(meeting.transcript);
    meetingFolder.file('transcript.txt', transcriptContent);

    // Add summary (if exists)
    if (meeting.summary) {
      const summaryMarkdown = formatSummaryAsMarkdown(meeting, transcriptContent);
      meetingFolder.file('summary.md', summaryMarkdown);
    }

    // Add metadata
    const exportedMeeting: ExportedMeeting = {
      metadata: {
        id: meeting.id,
        title: meeting.title,
        date: meeting.date.toISOString(),
        duration: meeting.duration,
        speakers: meeting.speakers,
        tags: meeting.tags,
        category: meeting.category,
        archived: meeting.archived,
        createdAt: meeting.createdAt.toISOString(),
        updatedAt: meeting.updatedAt.toISOString(),
      },
      transcript: meeting.transcript,
      summary: meeting.summary
        ? {
            ...meeting.summary,
            generatedAt: meeting.summary.generatedAt.toISOString(),
          }
        : undefined,
      hasAudio: !meeting.archived && meeting.audioBlob.size > 0,
    };

    meetingFolder.file('metadata.json', JSON.stringify(exportedMeeting, null, 2));

    // Report progress
    if (onProgress) {
      onProgress(progress);
    }
  }

  // Add a README file
  const readme = generateExportReadme(meetings.length);
  zip.file('README.txt', readme);

  // Generate ZIP blob
  return await zip.generateAsync(
    { type: 'blob' },
    (metadata) => {
      // Optional: report compression progress
      if (onProgress && metadata.percent) {
        onProgress(metadata.percent);
      }
    }
  );
}

/**
 * Import a meeting from an exported ZIP file
 * @param zipBlob - The ZIP file blob
 * @param onDuplicate - How to handle duplicates: 'replace', 'keep-both', or 'skip'
 * @returns The imported meeting ID
 */
export async function importMeeting(
  zipBlob: Blob,
  onDuplicate: 'replace' | 'keep-both' | 'skip' = 'keep-both'
): Promise<string> {
  const zip = await JSZip.loadAsync(zipBlob);

  // Read metadata
  const metadataFile = zip.file('metadata.json');
  if (!metadataFile) {
    throw new Error('Invalid export file: metadata.json not found');
  }

  const metadataContent = await metadataFile.async('text');
  const exportedMeeting: ExportedMeeting = JSON.parse(metadataContent);

  // Check if meeting already exists
  const existingMeeting = await getMeeting(exportedMeeting.metadata.id);

  if (existingMeeting) {
    if (onDuplicate === 'skip') {
      return existingMeeting.id;
    } else if (onDuplicate === 'keep-both') {
      // Generate new ID for the imported meeting
      exportedMeeting.metadata.id = crypto.randomUUID();
    }
    // If 'replace', use the existing ID (will overwrite)
  }

  // Read audio file (if present)
  let audioBlob = new Blob();
  const audioFile = zip.file('audio.webm');
  if (audioFile && exportedMeeting.hasAudio) {
    audioBlob = await audioFile.async('blob');
  }

  // Construct meeting object
  const meeting: Meeting = {
    id: exportedMeeting.metadata.id,
    title: exportedMeeting.metadata.title,
    date: new Date(exportedMeeting.metadata.date),
    duration: exportedMeeting.metadata.duration,
    audioBlob,
    transcript: exportedMeeting.transcript,
    summary: exportedMeeting.summary
      ? {
          ...exportedMeeting.summary,
          generatedAt: new Date(exportedMeeting.summary.generatedAt),
        }
      : undefined,
    speakers: exportedMeeting.metadata.speakers,
    tags: exportedMeeting.metadata.tags,
    category: exportedMeeting.metadata.category,
    archived: exportedMeeting.metadata.archived,
    createdAt: new Date(exportedMeeting.metadata.createdAt),
    updatedAt: new Date(exportedMeeting.metadata.updatedAt),
  };

  // Save to database
  await saveMeeting(meeting);

  return meeting.id;
}

/**
 * Import all meetings from a bulk export ZIP
 * @param zipBlob - The ZIP file blob
 * @param onProgress - Optional callback for progress updates
 * @param onDuplicate - How to handle duplicates
 * @returns Array of imported meeting IDs
 */
export async function importAllMeetings(
  zipBlob: Blob,
  onProgress?: (progress: number, current: number, total: number) => void,
  onDuplicate: 'replace' | 'keep-both' | 'skip' = 'keep-both'
): Promise<string[]> {
  const zip = await JSZip.loadAsync(zipBlob);

  // Get all folders (each folder is a meeting)
  const folders: string[] = [];
  zip.forEach((relativePath, file) => {
    if (file.dir && relativePath !== '/') {
      folders.push(relativePath);
    }
  });

  if (folders.length === 0) {
    throw new Error('No meetings found in export file');
  }

  const importedIds: string[] = [];

  for (let i = 0; i < folders.length; i++) {
    const folderPath = folders[i];
    const folder = zip.folder(folderPath);

    if (!folder) continue;

    try {
      // Read metadata
      const metadataFile = folder.file('metadata.json');
      if (!metadataFile) {
        console.warn(`Skipping ${folderPath}: no metadata.json`);
        continue;
      }

      const metadataContent = await metadataFile.async('text');
      const exportedMeeting: ExportedMeeting = JSON.parse(metadataContent);

      // Check for duplicates
      const existingMeeting = await getMeeting(exportedMeeting.metadata.id);

      if (existingMeeting) {
        if (onDuplicate === 'skip') {
          importedIds.push(existingMeeting.id);
          continue;
        } else if (onDuplicate === 'keep-both') {
          exportedMeeting.metadata.id = crypto.randomUUID();
        }
      }

      // Read audio file (if present)
      let audioBlob = new Blob();
      const audioFile = folder.file('audio.webm');
      if (audioFile && exportedMeeting.hasAudio) {
        audioBlob = await audioFile.async('blob');
      }

      // Construct meeting object
      const meeting: Meeting = {
        id: exportedMeeting.metadata.id,
        title: exportedMeeting.metadata.title,
        date: new Date(exportedMeeting.metadata.date),
        duration: exportedMeeting.metadata.duration,
        audioBlob,
        transcript: exportedMeeting.transcript,
        summary: exportedMeeting.summary
          ? {
              ...exportedMeeting.summary,
              generatedAt: new Date(exportedMeeting.summary.generatedAt),
            }
          : undefined,
        speakers: exportedMeeting.metadata.speakers,
        tags: exportedMeeting.metadata.tags,
        category: exportedMeeting.metadata.category,
        archived: exportedMeeting.metadata.archived,
        createdAt: new Date(exportedMeeting.metadata.createdAt),
        updatedAt: new Date(exportedMeeting.metadata.updatedAt),
      };

      // Save to database
      await saveMeeting(meeting);
      importedIds.push(meeting.id);

      // Report progress
      if (onProgress) {
        const progress = ((i + 1) / folders.length) * 100;
        onProgress(progress, i + 1, folders.length);
      }
    } catch (error) {
      console.error(`Failed to import ${folderPath}:`, error);
    }
  }

  return importedIds;
}

/**
 * Format summary as markdown for export
 */
function formatSummaryAsMarkdown(meeting: Meeting, transcript: string): string {
  if (!meeting.summary) return '';

  const { summary } = meeting;

  let markdown = `# ${meeting.title}\n\n`;
  markdown += `**Date:** ${meeting.date.toLocaleDateString()}\n`;
  markdown += `**Duration:** ${formatDuration(meeting.duration)}\n`;
  markdown += `**Category:** ${summary.category}\n`;
  markdown += `**Tags:** ${summary.tags.join(', ')}\n\n`;

  markdown += `---\n\n`;

  markdown += `## Executive Summary\n\n${summary.executive}\n\n`;

  markdown += `## Key Points\n\n`;
  summary.keyPoints.forEach((point) => {
    markdown += `- ${point}\n`;
  });
  markdown += `\n`;

  if (summary.actionItems.length > 0) {
    markdown += `## Action Items\n\n`;
    summary.actionItems.forEach((item) => {
      markdown += `- [ ] **${item.task}**\n`;
      markdown += `  - Owner: ${item.owner}\n`;
      if (item.deadline) markdown += `  - Deadline: ${item.deadline}\n`;
      if (item.priority) markdown += `  - Priority: ${item.priority}\n`;
    });
    markdown += `\n`;
  }

  if (summary.decisions.length > 0) {
    markdown += `## Decisions Made\n\n`;
    summary.decisions.forEach((decision) => {
      markdown += `- ${decision}\n`;
    });
    markdown += `\n`;
  }

  if (summary.questions.length > 0) {
    markdown += `## Questions / Open Items\n\n`;
    summary.questions.forEach((question) => {
      markdown += `- ${question}\n`;
    });
    markdown += `\n`;
  }

  markdown += `---\n\n`;
  markdown += `## Full Transcript\n\n`;
  markdown += transcript;

  markdown += `\n\n---\n\n`;
  markdown += `*Generated with Elaara Meeting Recorder*\n`;
  markdown += `*Summary generated on: ${summary.generatedAt.toLocaleString()}*\n`;

  return markdown;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Generate README content for bulk export
 */
function generateExportReadme(meetingCount: number): string {
  return `Elaara Meeting Recorder - Export Archive
========================================

This archive contains ${meetingCount} meeting(s) exported from Elaara.

Structure:
----------
Each meeting is stored in its own folder with the naming convention:
YYYY-MM-DD_meeting-title_shortid/

Each folder contains:
- metadata.json: Meeting metadata (title, date, speakers, tags, etc.)
- transcript.txt: Full meeting transcript
- summary.md: AI-generated summary (if available)
- audio.webm: Audio recording (if not archived)

Importing:
----------
To import these meetings back into Elaara:
1. Open Elaara in your browser
2. Go to Settings > Data & Privacy
3. Click "Import meetings from backup"
4. Select this ZIP file

Notes:
------
- Meetings marked as "archived" will not have audio files
- All data is stored in JSON and plain text formats for portability
- Summaries are in Markdown format for easy viewing
- Audio files are in WebM format

Export Date: ${new Date().toISOString()}
Application: Elaara Meeting Recorder
Version: 1.0.0

For more information, visit: https://github.com/yourusername/elaara
`;
}

/**
 * Download a blob as a file
 * @param blob - The blob to download
 * @param filename - The filename to save as
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 * @param text - The text to copy
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
