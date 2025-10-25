'use client';

import { useState, useEffect } from 'react';
import { useStorage } from '@/hooks/useStorage';
import { useToast } from '@/hooks/useToast';
import { loadSettings, saveSettings, applyDarkMode, DEFAULT_SETTINGS } from '@/lib/utils';
import { clearAllData, getDatabaseStats } from '@/lib/db';
import { exportAllMeetings, downloadBlob } from '@/lib/export';
import type { AppSettings } from '@/lib/types';

export default function SettingsPage() {
  const { used, quota, percentage, usedFormatted, quotaFormatted, warningMessage } = useStorage();
  const { success, error: showError } = useToast();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState({
    totalMeetings: 0,
    archivedMeetings: 0,
    totalDuration: 0,
  });

  useEffect(() => {
    // Load settings
    const loaded = loadSettings();
    setSettings(loaded);

    // Load stats
    loadStats();
  }, []);

  const loadStats = async () => {
    const dbStats = await getDatabaseStats();
    setStats({
      totalMeetings: dbStats.totalMeetings,
      archivedMeetings: dbStats.archivedMeetings,
      totalDuration: dbStats.totalDuration,
    });
  };

  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);

    // Apply dark mode immediately
    if (key === 'darkMode') {
      applyDarkMode(value as boolean);
    }

    success('Settings saved');
  };

  const handleExportAll = async () => {
    try {
      setExporting(true);
      const blob = await exportAllMeetings((progress) => {
        // Could show progress here
      });

      const filename = `elaara-export-${new Date().toISOString().split('T')[0]}.zip`;
      downloadBlob(blob, filename);
      success('All meetings exported');
    } catch (err) {
      showError('Failed to export meetings');
    } finally {
      setExporting(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('This will permanently delete ALL meetings and data. This cannot be undone. Are you sure?')) {
      return;
    }

    if (!confirm('Are you ABSOLUTELY sure? This will delete everything.')) {
      return;
    }

    try {
      await clearAllData();
      await loadStats();
      success('All data cleared');
    } catch (err) {
      showError('Failed to clear data');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      {/* General Settings */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          General
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Dark Mode</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use dark theme throughout the app
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Storage Settings */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Storage
        </h2>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">
                Using {usedFormatted} of {quotaFormatted}
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  percentage >= 95
                    ? 'bg-red-500'
                    : percentage >= 80
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            {warningMessage && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                {warningMessage}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              Auto-Archive
            </h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.autoArchiveDays !== null}
                  onChange={(e) =>
                    handleSettingChange('autoArchiveDays', e.target.checked ? 90 : null)
                  }
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-archive meetings older than
                </span>
              </label>
              {settings.autoArchiveDays !== null && (
                <input
                  type="number"
                  value={settings.autoArchiveDays}
                  onChange={(e) =>
                    handleSettingChange('autoArchiveDays', parseInt(e.target.value))
                  }
                  className="input w-20"
                  min="1"
                />
              )}
              <span className="text-sm text-gray-700 dark:text-gray-300">days</span>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              Auto-Delete Archived
            </h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.autoDeleteArchivedDays !== null}
                  onChange={(e) =>
                    handleSettingChange('autoDeleteArchivedDays', e.target.checked ? 180 : null)
                  }
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-delete archived meetings older than
                </span>
              </label>
              {settings.autoDeleteArchivedDays !== null && (
                <input
                  type="number"
                  value={settings.autoDeleteArchivedDays}
                  onChange={(e) =>
                    handleSettingChange('autoDeleteArchivedDays', parseInt(e.target.value))
                  }
                  className="input w-20"
                  min="1"
                />
              )}
              <span className="text-sm text-gray-700 dark:text-gray-300">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Data & Privacy
        </h2>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Privacy First:</strong> All your data is stored locally in your browser.
              Your recordings never leave your device unless you export them. Clear browser
              data will permanently delete all recordings.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              Database Statistics
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Total Meetings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.totalMeetings}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Archived</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.archivedMeetings}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Total Duration</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.floor(stats.totalDuration / 3600)}h
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={handleExportAll}
              disabled={exporting || stats.totalMeetings === 0}
              className="btn btn-primary w-full"
            >
              {exporting ? 'Exporting...' : 'Export All Meetings'}
            </button>

            <button
              onClick={handleClearAll}
              disabled={stats.totalMeetings === 0}
              className="btn btn-danger w-full"
            >
              Clear All Data
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="card p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex justify-between items-center"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Advanced Settings
          </h2>
          <svg
            className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
              showAdvanced ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                AI Model
              </h3>
              <select
                value={settings.preferredModel}
                onChange={(e) =>
                  handleSettingChange('preferredModel', e.target.value as 'haiku' | 'sonnet')
                }
                className="input w-full"
              >
                <option value="haiku">Claude Haiku (Faster, Lower Cost)</option>
                <option value="sonnet">Claude Sonnet (More Detailed)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  Enable Prompt Caching
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Reduces AI costs by ~50%
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enablePromptCaching}
                  onChange={(e) => handleSettingChange('enablePromptCaching', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
