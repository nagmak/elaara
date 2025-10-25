'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getMeeting, updateMeeting, deleteMeeting, archiveMeeting } from '@/lib/db';
import { useToast } from '@/hooks/useToast';
import { exportMeeting, downloadBlob, copyToClipboard } from '@/lib/export';
import { logCost } from '@/lib/costs';
import { formatDurationLong } from '@/lib/audio';
import type { Meeting, Summary } from '@/lib/types';

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'details'>('transcript');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');

  // Load meeting data
  useEffect(() => {
    loadMeeting();
  }, [meetingId]);

  const loadMeeting = async () => {
    try {
      setLoading(true);
      const data = await getMeeting(meetingId);
      if (data) {
        setMeeting(data);
        setTitle(data.title);
      }
    } catch (err) {
      showError('Failed to load meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!meeting) return;

    setIsGeneratingSummary(true);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: meeting.transcript,
          meetingId: meeting.id,
          model: 'haiku',
          useCache: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();

      // Log cost (silent)
      if (data.cost) {
        await logCost(meetingId, 'summarization', data.cost);
      }

      // Update meeting with summary
      const summary: Summary = {
        ...data.summary,
        generatedAt: new Date(),
        model: 'haiku' as const,
      };

      await updateMeeting(meetingId, { summary });

      // Reload meeting
      await loadMeeting();

      success('Summary generated successfully!');
      setActiveTab('summary');
    } catch (err) {
      showError('Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!meeting) return;

    try {
      await updateMeeting(meetingId, { title });
      setEditingTitle(false);
      success('Title updated');
      await loadMeeting();
    } catch (err) {
      showError('Failed to update title');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this meeting? This cannot be undone.')) {
      return;
    }

    try {
      await deleteMeeting(meetingId);
      success('Meeting deleted');
      router.push('/');
    } catch (err) {
      showError('Failed to delete meeting');
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this meeting? The audio file will be deleted to save space, but the transcript and summary will be kept.')) {
      return;
    }

    try {
      await archiveMeeting(meetingId);
      success('Meeting archived');
      await loadMeeting();
    } catch (err) {
      showError('Failed to archive meeting');
    }
  };

  const handleExport = async () => {
    if (!meeting) return;

    try {
      const blob = await exportMeeting(meetingId);
      const filename = `${meeting.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.zip`;
      downloadBlob(blob, filename);
      success('Meeting exported');
    } catch (err) {
      showError('Failed to export meeting');
    }
  };

  const handleCopyTranscript = async () => {
    if (!meeting) return;

    try {
      await copyToClipboard(meeting.transcript);
      success('Transcript copied to clipboard');
    } catch (err) {
      showError('Failed to copy transcript');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">Meeting not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            {editingTitle ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input flex-1"
                  autoFocus
                />
                <button onClick={handleSaveTitle} className="btn btn-primary">
                  Save
                </button>
                <button onClick={() => setEditingTitle(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {meeting.title}
                </h1>
                <button
                  onClick={() => setEditingTitle(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{new Date(meeting.date).toLocaleString()}</span>
              <span>•</span>
              <span>{formatDurationLong(meeting.duration)}</span>
              {meeting.archived && (
                <>
                  <span>•</span>
                  <span className="badge badge-gray">Archived</span>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleExport} className="btn btn-secondary" title="Export">
              Export
            </button>
            {!meeting.archived && (
              <button onClick={handleArchive} className="btn btn-secondary" title="Archive">
                Archive
              </button>
            )}
            <button onClick={handleDelete} className="btn btn-danger" title="Delete">
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'transcript'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Transcript
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'summary'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Summary {meeting.summary && '✓'}
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Details
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Transcript Tab */}
          {activeTab === 'transcript' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Transcript
                </h2>
                <button onClick={handleCopyTranscript} className="btn btn-secondary text-sm">
                  Copy to Clipboard
                </button>
              </div>
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                  {meeting.transcript}
                </pre>
              </div>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {meeting.summary ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Executive Summary
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300">
                      {meeting.summary.executive}
                    </p>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Key Points
                    </h2>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                      {meeting.summary.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  {meeting.summary.actionItems.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Action Items
                      </h2>
                      <div className="space-y-2">
                        {meeting.summary.actionItems.map((item, index) => (
                          <div key={index} className="border-l-4 border-primary-500 pl-4 py-2">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{item.task}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Owner: {item.owner}
                              {item.deadline && ` • Deadline: ${item.deadline}`}
                              {item.priority && ` • Priority: ${item.priority}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {meeting.summary.decisions.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Decisions Made
                      </h2>
                      <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                        {meeting.summary.decisions.map((decision, index) => (
                          <li key={index}>{decision}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {meeting.summary.questions.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Questions / Open Items
                      </h2>
                      <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                        {meeting.summary.questions.map((question, index) => (
                          <li key={index}>{question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No summary generated yet
                  </p>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary}
                    className="btn btn-primary"
                  >
                    {isGeneratingSummary ? (
                      <>
                        <div className="spinner inline-block mr-2" />
                        Generating...
                      </>
                    ) : (
                      'Generate Summary'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</h3>
                <p className="text-gray-900 dark:text-gray-100">{meeting.category || 'Not set'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Tags</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {meeting.tags.length > 0 ? (
                    meeting.tags.map((tag, index) => (
                      <span key={index} className="badge badge-blue">{tag}</span>
                    ))
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">No tags</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Speakers</h3>
                <div className="space-y-1 mt-1">
                  {meeting.speakers.map((speaker) => (
                    <div key={speaker.id} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: speaker.color }}
                      />
                      <span className="text-gray-900 dark:text-gray-100">{speaker.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
