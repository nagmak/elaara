'use client';

import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';
import { formatDurationLong } from '@/lib/audio';
import type { Meeting } from '@/lib/types';

interface MeetingCardProps {
  meeting: Meeting;
}

export default function MeetingCard({ meeting }: MeetingCardProps) {
  const hasSummary = !!meeting.summary;

  return (
    <Link href={`/meeting/${meeting.id}`}>
      <div className="card p-4 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {meeting.title}
          </h3>
          {meeting.archived && (
            <span className="badge badge-gray ml-2">Archived</span>
          )}
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>{formatRelativeTime(meeting.date)}</p>
          <p>Duration: {formatDurationLong(meeting.duration)}</p>
          {meeting.speakers.length > 0 && (
            <p>{meeting.speakers.length} {meeting.speakers.length === 1 ? 'speaker' : 'speakers'}</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {meeting.category && (
            <span className="badge badge-blue">{meeting.category}</span>
          )}
          {meeting.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="badge badge-gray">{tag}</span>
          ))}
          {hasSummary ? (
            <span className="badge badge-green">Summary available</span>
          ) : (
            <span className="badge badge-yellow">Transcript only</span>
          )}
        </div>
      </div>
    </Link>
  );
}
