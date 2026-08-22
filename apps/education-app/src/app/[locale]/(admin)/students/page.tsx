'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GraduationCap, UserCheck, Award } from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { useBranches } from '@/lib/branches';
import { useStudents, useCreateStudent } from '@/lib/students';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'info'> = {
  ACTIVE: 'success',
  WITHDRAWN: 'default',
  GRADUATED: 'info',
};

export default function StudentsPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { data, isLoading } = useStudents();
  const { data: branchesData } = useBranches();
  const createStudent = useCreateStudent();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createStudent.mutateAsync({
        branchId,
        registrationNumber,
        firstName,
        lastName,
      });
      setBranchId('');
      setRegistrationNumber('');
      setFirstName('');
      setLastName('');
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const branchNameById = (id: string) =>
    branchesData?.data.find((b) => b.id === id)?.name ?? id;

  const students = data?.data ?? [];
  const activeCount = students.filter((s) => s.status === 'ACTIVE').length;
  const graduatedCount = students.filter((s) => s.status === 'GRADUATED').length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.students')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.addStudent')}</Button>
      </div>

      {!isLoading && students.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={GraduationCap}
            color="primary"
            label={t('education.totalStudents')}
            value={students.length}
          />
          <StatCard
            icon={UserCheck}
            color="primary"
            label={t('education.activeStudents')}
            value={activeCount}
          />
          <StatCard
            icon={Award}
            color="primary"
            label={t('education.graduatedStudents')}
            value={graduatedCount}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="3rem" />
          <Skeleton height="3rem" />
        </div>
      )}

      {!isLoading && students.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-500">
            <GraduationCap size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noStudentsYet')}</p>
        </div>
      )}

      {!isLoading && students.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.studentName')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.studentRegistrationNumber')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.studentBranch')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.studentStatus')}
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-gray-100 last:border-0 hover:bg-primary-50/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${student.firstName} ${student.lastName}`}
                        color="primary"
                      />
                      <Link
                        href={`/${locale}/students/${student.id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {student.firstName} {student.lastName}
                      </Link>
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{student.registrationNumber}</td>
                  <td className="p-3 text-gray-600">{branchNameById(student.branchId)}</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANT[student.status] ?? 'default'}>
                      {student.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addStudent')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createStudent.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.studentBranch')}
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {branchesData?.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t('education.studentRegistrationNumber')}
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            required
          />
          <Input
            label={t('education.studentFirstName')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label={t('education.studentLastName')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
