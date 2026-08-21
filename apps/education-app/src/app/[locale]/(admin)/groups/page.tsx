'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Button,
  Input,
  Card,
  CardContent,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { useGroups, useCreateGroup } from '@/lib/groups';
import { useBranches } from '@/lib/branches';
import { useTeachers } from '@/lib/teachers';
import { useTranslation } from '@/lib/i18n';

interface GroupFormState {
  name: string;
  branchId: string;
  level: string;
  subject: string;
  room: string;
  teacherId: string;
}

const EMPTY_FORM: GroupFormState = {
  name: '',
  branchId: '',
  level: '',
  subject: '',
  room: '',
  teacherId: '',
};

export default function GroupsPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { data, isLoading } = useGroups();
  const { data: branchesData } = useBranches(1, 100);
  const { data: teachersData } = useTeachers(1, 100);
  const createGroup = useCreateGroup();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<GroupFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createGroup.mutateAsync({
        name: form.name,
        branchId: form.branchId,
        level: form.level || undefined,
        subject: form.subject || undefined,
        room: form.room || undefined,
        teacherId: form.teacherId || undefined,
      });
      setForm(EMPTY_FORM);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.groups')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.addGroup')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noGroupsYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((group) => (
            <Card key={group.id} className="transition-shadow hover:shadow-md">
              <CardContent>
                <Link
                  href={`/${locale}/groups/${group.id}`}
                  className="font-medium text-primary-700 hover:underline"
                >
                  {group.name}
                </Link>
                {(group.subject || group.level) && (
                  <p className="mt-1 text-sm text-gray-500">
                    {[group.subject, group.level].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {group.teacher
                    ? `${group.teacher.firstName} ${group.teacher.lastName}`
                    : t('education.noTeacherAssigned')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addGroup')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createGroup.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.groupName')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.groupBranch')}
            </label>
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {(branchesData?.data ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label={t('education.groupLevel')}
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          />
          <Input
            label={t('education.groupSubject')}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <Input
            label={t('education.groupRoom')}
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.groupTeacher')}
            </label>
            <select
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('education.noTeacherAssigned')}</option>
              {(teachersData?.data ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
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
