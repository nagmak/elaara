'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMeetings } from '@/hooks/useMeetings';
import { formatDurationLong } from '@/lib/audio';
import MeetingCard from '@/components/MeetingCard';

export default function Dashboard() {
  const { meetings, loading } = useMeetings();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter meetings based on search
  const filteredMeetings = meetings.filter((meeting) =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate stats
  const totalMeetings = meetings.length;
  const totalDuration = meetings.reduce((sum, m) => sum + m.duration, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Meetings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalMeetings} {totalMeetings === 1 ? 'meeting' : 'meetings'} • {formatDurationLong(totalDuration)} total
          </p>
        </div>

        <Link
          href="/record"
          className="btn btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
          New Recording
        </Link>
      </div>

      {/* Search Bar */}
      <div className="card p-4">
        <input
          type="text"
          placeholder="Search meetings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full"
        />
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery ? 'No meetings found matching your search.' : 'No meetings yet. Start recording your first meeting!'}
          </p>
          {!searchQuery && (
            <Link href="/record" className="btn btn-primary mt-4 inline-block">
              Start Recording
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  );
}
