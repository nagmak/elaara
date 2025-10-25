/**
 * IndexedDB wrapper using idb library for local browser storage
 * All meeting data is stored locally in the user's browser
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { MeetingDB, CostTrackingDB, Meeting, CostTracking, Summary, SummaryDB } from './types';

const DB_NAME = 'meeting-recorder-db';
const DB_VERSION = 1;

interface MeetingDBSchema extends DBSchema {
  meetings: {
    key: string;
    value: MeetingDB;
    indexes: {
      'by-date': string;
      'by-category': string;
    };
  };
  costs: {
    key: string;
    value: CostTrackingDB;
  };
}

let dbInstance: IDBPDatabase<MeetingDBSchema> | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBPDatabase<MeetingDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<MeetingDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create meetings object store
      if (!db.objectStoreNames.contains('meetings')) {
        const meetingStore = db.createObjectStore('meetings', { keyPath: 'id' });
        meetingStore.createIndex('by-date', 'date');
        meetingStore.createIndex('by-category', 'category');
      }

      // Create costs object store
      if (!db.objectStoreNames.contains('costs')) {
        db.createObjectStore('costs', { keyPath: 'month' });
      }
    },
  });

  return dbInstance;
}

/**
 * Convert Meeting object to MeetingDB for storage
 */
function meetingToDB(meeting: Meeting): MeetingDB {
  return {
    ...meeting,
    date: meeting.date.toISOString(),
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
    audioBlob: meeting.archived ? null : meeting.audioBlob,
    summary: meeting.summary ? summaryToDB(meeting.summary) : undefined,
  };
}

/**
 * Convert MeetingDB to Meeting object
 */
function dbToMeeting(db: MeetingDB): Meeting {
  return {
    ...db,
    date: new Date(db.date),
    createdAt: new Date(db.createdAt),
    updatedAt: new Date(db.updatedAt),
    audioBlob: db.audioBlob || new Blob(),
    summary: db.summary ? dbToSummary(db.summary) : undefined,
  };
}

/**
 * Convert Summary to SummaryDB
 */
function summaryToDB(summary: Summary): SummaryDB {
  return {
    ...summary,
    generatedAt: summary.generatedAt.toISOString(),
  };
}

/**
 * Convert SummaryDB to Summary
 */
function dbToSummary(db: SummaryDB): Summary {
  return {
    ...db,
    generatedAt: new Date(db.generatedAt),
  };
}

/**
 * Convert CostTracking to CostTrackingDB
 */
function costTrackingToDB(cost: CostTracking): CostTrackingDB {
  return {
    ...cost,
    lastUpdated: cost.lastUpdated.toISOString(),
  };
}

/**
 * Convert CostTrackingDB to CostTracking
 */
function dbToCostTracking(db: CostTrackingDB): CostTracking {
  return {
    ...db,
    lastUpdated: new Date(db.lastUpdated),
  };
}

// ==================== MEETING CRUD OPERATIONS ====================

/**
 * Save a meeting to IndexedDB
 */
export async function saveMeeting(meeting: Meeting): Promise<void> {
  const db = await initDB();
  const meetingDB = meetingToDB(meeting);
  await db.put('meetings', meetingDB);
}

/**
 * Get a meeting by ID
 */
export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const db = await initDB();
  const meetingDB = await db.get('meetings', id);
  return meetingDB ? dbToMeeting(meetingDB) : undefined;
}

/**
 * Get all meetings, sorted by date (newest first)
 */
export async function getAllMeetings(): Promise<Meeting[]> {
  const db = await initDB();
  const meetingsDB = await db.getAllFromIndex('meetings', 'by-date');
  // Sort by date descending (newest first)
  return meetingsDB
    .map(dbToMeeting)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Get meetings by category
 */
export async function getMeetingsByCategory(category: string): Promise<Meeting[]> {
  const db = await initDB();
  const meetingsDB = await db.getAllFromIndex('meetings', 'by-category');
  return meetingsDB
    .filter(m => m.category === category)
    .map(dbToMeeting)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Update a meeting
 */
export async function updateMeeting(id: string, updates: Partial<Meeting>): Promise<void> {
  const db = await initDB();
  const existing = await db.get('meetings', id);

  if (!existing) {
    throw new Error(`Meeting with id ${id} not found`);
  }

  // Build the update object with proper types
  const updatesDB: Partial<MeetingDB> = {};

  if (updates.title !== undefined) updatesDB.title = updates.title;
  if (updates.transcript !== undefined) updatesDB.transcript = updates.transcript;
  if (updates.speakers !== undefined) updatesDB.speakers = updates.speakers;
  if (updates.tags !== undefined) updatesDB.tags = updates.tags;
  if (updates.category !== undefined) updatesDB.category = updates.category;
  if (updates.archived !== undefined) updatesDB.archived = updates.archived;
  if (updates.duration !== undefined) updatesDB.duration = updates.duration;
  if (updates.audioBlob !== undefined) updatesDB.audioBlob = updates.audioBlob;
  if (updates.date !== undefined) updatesDB.date = updates.date.toISOString();
  if (updates.summary !== undefined) updatesDB.summary = summaryToDB(updates.summary);

  const updated: MeetingDB = {
    ...existing,
    ...updatesDB,
    updatedAt: new Date().toISOString(),
  };

  await db.put('meetings', updated);
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('meetings', id);
}

/**
 * Archive a meeting (removes audio blob to save space)
 */
export async function archiveMeeting(id: string): Promise<void> {
  await updateMeeting(id, {
    archived: true,
    audioBlob: new Blob(), // Empty blob
  });
}

/**
 * Search meetings by title, transcript, or summary
 */
export async function searchMeetings(query: string): Promise<Meeting[]> {
  const allMeetings = await getAllMeetings();
  const lowerQuery = query.toLowerCase();

  return allMeetings.filter(meeting => {
    return (
      meeting.title.toLowerCase().includes(lowerQuery) ||
      meeting.transcript.toLowerCase().includes(lowerQuery) ||
      meeting.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (meeting.summary?.executive.toLowerCase().includes(lowerQuery)) ||
      (meeting.summary?.keyPoints.some(kp => kp.toLowerCase().includes(lowerQuery)))
    );
  });
}

// ==================== COST TRACKING OPERATIONS ====================

/**
 * Get cost tracking for a specific month
 */
export async function getCostTracking(month: string): Promise<CostTracking | undefined> {
  const db = await initDB();
  const costDB = await db.get('costs', month);
  return costDB ? dbToCostTracking(costDB) : undefined;
}

/**
 * Update cost tracking for a month
 */
export async function updateCostTracking(
  month: string,
  transcriptionCost: number,
  summarizationCost: number
): Promise<void> {
  const db = await initDB();
  const existing = await db.get('costs', month);

  const updated: CostTrackingDB = existing
    ? {
        ...existing,
        transcriptionCost: existing.transcriptionCost + transcriptionCost,
        summarizationCost: existing.summarizationCost + summarizationCost,
        meetingCount: existing.meetingCount + 1,
        totalCost: existing.transcriptionCost + existing.summarizationCost + transcriptionCost + summarizationCost,
        lastUpdated: new Date().toISOString(),
      }
    : {
        month,
        transcriptionCost,
        summarizationCost,
        meetingCount: 1,
        totalCost: transcriptionCost + summarizationCost,
        lastUpdated: new Date().toISOString(),
      };

  await db.put('costs', updated);
}

/**
 * Get all cost tracking data
 */
export async function getAllCostTracking(): Promise<CostTracking[]> {
  const db = await initDB();
  const costsDB = await db.getAll('costs');
  return costsDB.map(dbToCostTracking);
}

// ==================== STORAGE MANAGEMENT ====================

/**
 * Get browser storage usage information
 */
export async function getStorageUsage(): Promise<{
  used: number;
  quota: number;
  percentage: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (used / quota) * 100 : 0;

    return { used, quota, percentage };
  }

  return { used: 0, quota: 0, percentage: 0 };
}

/**
 * Get meetings that should be auto-archived based on age
 */
export async function getMeetingsForAutoArchive(daysOld: number): Promise<Meeting[]> {
  const allMeetings = await getAllMeetings();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return allMeetings.filter(
    meeting => !meeting.archived && meeting.date < cutoffDate
  );
}

/**
 * Get archived meetings that should be auto-deleted based on age
 */
export async function getArchivedMeetingsForDeletion(daysOld: number): Promise<Meeting[]> {
  const allMeetings = await getAllMeetings();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return allMeetings.filter(
    meeting => meeting.archived && meeting.updatedAt < cutoffDate
  );
}

/**
 * Clear all data from the database (use with caution!)
 */
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  await db.clear('meetings');
  await db.clear('costs');
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalMeetings: number;
  archivedMeetings: number;
  totalDuration: number; // seconds
  storageInfo: { used: number; quota: number; percentage: number };
}> {
  const allMeetings = await getAllMeetings();
  const storageInfo = await getStorageUsage();

  return {
    totalMeetings: allMeetings.length,
    archivedMeetings: allMeetings.filter(m => m.archived).length,
    totalDuration: allMeetings.reduce((sum, m) => sum + m.duration, 0),
    storageInfo,
  };
}
