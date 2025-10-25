/**
 * useStorage Hook
 * Manages browser storage information and warnings
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStorageUsage } from '@/lib/db';
import { formatFileSize } from '@/lib/utils';

export function useStorage() {
  const [used, setUsed] = useState(0);
  const [quota, setQuota] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load storage info
  const loadStorageInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await getStorageUsage();
      setUsed(info.used);
      setQuota(info.quota);
      setPercentage(info.percentage);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  // Get warning level
  const getWarningLevel = useCallback((): 'none' | 'low' | 'high' => {
    if (percentage >= 95) return 'high';
    if (percentage >= 80) return 'low';
    return 'none';
  }, [percentage]);

  // Get warning message
  const getWarningMessage = useCallback((): string | null => {
    const level = getWarningLevel();

    if (level === 'high') {
      return 'Storage almost full. Please archive or delete meetings.';
    }
    if (level === 'low') {
      return 'Storage is running low. Consider archiving old meetings.';
    }
    return null;
  }, [getWarningLevel]);

  return {
    used,
    quota,
    percentage,
    loading,
    usedFormatted: formatFileSize(used),
    quotaFormatted: formatFileSize(quota),
    warningLevel: getWarningLevel(),
    warningMessage: getWarningMessage(),
    refresh: loadStorageInfo,
  };
}
