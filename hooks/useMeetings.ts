/**
 * useMeetings Hook
 * Manages meeting CRUD operations and IndexedDB interactions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllMeetings,
  getMeeting,
  saveMeeting,
  updateMeeting,
  deleteMeeting,
  archiveMeeting,
  searchMeetings,
} from '@/lib/db';
import type { Meeting } from '@/lib/types';

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all meetings
  const loadMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allMeetings = await getAllMeetings();
      setMeetings(allMeetings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load meetings';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load meetings on mount
  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Get single meeting by ID
  const getMeetingById = useCallback(async (id: string): Promise<Meeting | undefined> => {
    try {
      return await getMeeting(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get meeting';
      setError(errorMessage);
      return undefined;
    }
  }, []);

  // Save new meeting
  const saveMeetingData = useCallback(async (meeting: Meeting) => {
    try {
      await saveMeeting(meeting);
      await loadMeetings(); // Reload list
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save meeting';
      setError(errorMessage);
      return false;
    }
  }, [loadMeetings]);

  // Update existing meeting
  const updateMeetingData = useCallback(async (id: string, updates: Partial<Meeting>) => {
    try {
      await updateMeeting(id, updates);
      await loadMeetings(); // Reload list
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update meeting';
      setError(errorMessage);
      return false;
    }
  }, [loadMeetings]);

  // Delete meeting
  const deleteMeetingData = useCallback(async (id: string) => {
    try {
      await deleteMeeting(id);
      await loadMeetings(); // Reload list
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete meeting';
      setError(errorMessage);
      return false;
    }
  }, [loadMeetings]);

  // Archive meeting
  const archiveMeetingData = useCallback(async (id: string) => {
    try {
      await archiveMeeting(id);
      await loadMeetings(); // Reload list
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive meeting';
      setError(errorMessage);
      return false;
    }
  }, [loadMeetings]);

  // Search meetings
  const search = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const results = await searchMeetings(query);
      setMeetings(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    meetings,
    loading,
    error,
    loadMeetings,
    getMeetingById,
    saveMeeting: saveMeetingData,
    updateMeeting: updateMeetingData,
    deleteMeeting: deleteMeetingData,
    archiveMeeting: archiveMeetingData,
    search,
  };
}
