'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Skeleton } from '@smartcity/ui';
import { AttendanceStatus } from '@smartcity/types';
import { useGroups } from '@/lib/groups';
import { useGroupStudents } from '@/lib/group-students';
import { useGroupAttendance, useBulkMarkAttendance } from '@/lib/attendance';
import { useTranslation } from '@/lib/i18n';

const STATUS_OPTIONS: { value: AttendanceStatus; labelKey: string; activeClass: string }[] = [
  { value: AttendanceStatus.PRESENT, labelKey: 'education.statusPresent', activeClass: 'bg-green-600 text-white border-green-600' },
  { value: AttendanceStatus.ABSENT, labelKey: 'education.statusAbsent', activeClass: 'bg-red-600 text-white border-red-600' },
  { value: AttendanceStatus.LATE, labelKey: 'education.statusLate', activeClass: 'bg-yellow-500 text-white border-yellow-500' },
  { value: AttendanceStatus.EXCUSED, labelKey: 'education.statusExcused', activeClass: 'bg-blue-600 text-white border-blue-600' },
];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const { data: groupsData, isLoading: isLoadingGroups } = useGroups(1, 100);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [statusByStudent, setStatusByStudent] = useState<Record<string, AttendanceStatus>>({});
  const [notesByStudent, setNotesByStudent] = useState<Record<string, string>>({});

  const { data: enrollments, isLoading: isLoadingEnrollments } = useGroupStudents(
    groupId || undefined,
  );
  const { data: existingAttendance } = useGroupAttendance(
    groupId || undefined,
    groupId ? date : undefined,
  );
  const bulkMark = useBulkMarkAttendance();

  const students = useMemo(() => (enrollments ?? []).map((e) => e.student), [enrollments]);
  const prefilledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = groupId && date ? `${groupId}|${date}` : null;
    if (!key || key === prefilledKeyRef.current) return;
    if (students.length === 0) return;

    const nextStatus: Record<string, AttendanceStatus> = {};
    const nextNotes: Record<string, string> = {};

    for (const student of students) {
      const existing = existingAttendance?.find((a) => a.studentId === student.id);
      nextStatus[student.id] = existing?.status ?? AttendanceStatus.PRESENT;
      nextNotes[student.id] = existing?.notes ?? '';
    }

    setStatusByStudent(nextStatus);
    setNotesByStudent(nextNotes);

    // Only lock in the key once existingAttendance has actually resolved
    // (undefined -> loaded). While it's still loading, keep re-running so
    // the real records get applied once the query settles; after that,
    // further reference changes (e.g. refocus refetches) are ignored.
    if (existingAttendance !== undefined) {
      prefilledKeyRef.current = key;
    }
  }, [students, existingAttendance, groupId, date]);

  const markAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    for (const student of students) {
      next[student.id] = AttendanceStatus.PRESENT;
    }
    setStatusByStudent(next);
  };

  const handleSave = async () => {
    if (!groupId) return;

    await bulkMark.mutateAsync({
      groupId,
      date,
      entries: students.map((student) => ({
        studentId: student.id,
        status: statusByStudent[student.id] ?? AttendanceStatus.PRESENT,
        notes: notesByStudent[student.id] || undefined,
      })),
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.attendance')}</h1>
      </div>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('education.selectGroupForAttendance')}
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">—</option>
            {(groupsData?.data ?? []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{t('education.selectDate')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {!groupId && (
        <p className="text-sm text-gray-500">{t('education.selectGroupAndDatePrompt')}</p>
      )}

      {groupId && isLoadingEnrollments && <Skeleton height="6rem" />}

      {groupId && !isLoadingEnrollments && students.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              {t('education.markAllPresent')}
            </Button>
            <Button onClick={handleSave} loading={bulkMark.isPending}>
              {t('education.saveAttendance')}
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-gray-100">
            {students.map((student) => (
              <div key={student.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-gray-900">
                  {student.firstName} {student.lastName}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex gap-1.5">
                    {STATUS_OPTIONS.map((option) => {
                      const active = statusByStudent[student.id] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setStatusByStudent({ ...statusByStudent, [student.id]: option.value });
                            if (option.value === AttendanceStatus.PRESENT) {
                              setNotesByStudent({ ...notesByStudent, [student.id]: '' });
                            }
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active ? option.activeClass : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {t(option.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                  {statusByStudent[student.id] !== AttendanceStatus.PRESENT && (
                    <input
                      type="text"
                      placeholder={t('education.attendanceNotes')}
                      value={notesByStudent[student.id] ?? ''}
                      onChange={(e) =>
                        setNotesByStudent({ ...notesByStudent, [student.id]: e.target.value })
                      }
                      className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoadingGroups && <Skeleton height="4rem" />}
    </div>
  );
}
