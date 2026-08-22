'use client';

import { useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, Modal, Skeleton } from '@smartcity/ui';
import { useGroup } from '@/lib/groups';
import { useStudents } from '@/lib/students';
import {
  useGroupStudents,
  useCreateGroupStudent,
  useRemoveGroupStudent,
} from '@/lib/group-students';
import { useTranslation } from '@/lib/i18n';

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const groupId = params?.id as string;

  const { data: group, isLoading: isLoadingGroup } = useGroup(groupId);
  const { data: enrollments, isLoading: isLoadingEnrollments } = useGroupStudents(groupId);
  const { data: studentsData } = useStudents(1, 100);

  const createEnrollment = useCreateGroupStudent();
  const removeEnrollment = useRemoveGroupStudent(groupId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enrolledStudentIds = new Set((enrollments ?? []).map((e) => e.studentId));
  const availableStudents = (studentsData?.data ?? []).filter(
    (s) => !enrolledStudentIds.has(s.id),
  );

  const handleEnroll = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createEnrollment.mutateAsync({ groupId, studentId: selectedStudentId });
      setSelectedStudentId('');
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm(t('education.confirmRemoveFromGroup'))) return;
    await removeEnrollment.mutateAsync(id);
  };

  if (isLoadingGroup) {
    return <Skeleton height="6rem" />;
  }

  if (!group) {
    return (
      <div>
        <Link href={`/${locale}/groups`} className="text-sm text-primary-700 hover:underline">
          &larr; {t('education.backToGroups')}
        </Link>
        <p className="mt-4 text-sm text-gray-500">{t('education.noGroupsYet')}</p>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/${locale}/groups`} className="text-sm text-primary-700 hover:underline">
        &larr; {t('education.backToGroups')}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{group.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {[group.subject, group.level, group.room].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {group.teacher
            ? `${group.teacher.firstName} ${group.teacher.lastName}`
            : t('education.noTeacherAssigned')}
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t('education.groupStudents')}</h2>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.enrollStudent')}</Button>
      </div>

      {isLoadingEnrollments && <Skeleton height="4rem" />}

      {!isLoadingEnrollments && enrollments?.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noStudentsEnrolledYet')}</p>
      )}

      {!isLoadingEnrollments && enrollments && enrollments.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardContent>
                <p className="font-medium text-gray-900">
                  {enrollment.student.firstName} {enrollment.student.lastName}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {enrollment.student.registrationNumber}
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemove(enrollment.id)}
                    loading={removeEnrollment.isPending}
                  >
                    {t('education.removeFromGroup')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.enrollStudent')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEnroll} loading={createEnrollment.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleEnroll} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.selectStudent')}
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {availableStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName} ({student.registrationNumber})
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
