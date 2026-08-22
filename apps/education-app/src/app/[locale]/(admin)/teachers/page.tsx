'use client';

import { useState, FormEvent } from 'react';
import { Presentation, DollarSign, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { PaymentType } from '@smartcity/types';
import type { ITeacher } from '@smartcity/types';
import {
  useTeachers,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
} from '@/lib/teachers';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';

interface TeacherFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialties: string;
  levels: string;
  hourlyRate: string;
}

const EMPTY_FORM: TeacherFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  specialties: '',
  levels: '',
  hourlyRate: '',
};

function toCommaList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function TeachersPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useTeachers();
  const createTeacher = useCreateTeacher();
  const deleteTeacher = useDeleteTeacher();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ITeacher | null>(null);
  const [form, setForm] = useState<TeacherFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const updateTeacher = useUpdateTeacher(editingTeacher?.id ?? '');

  const openCreateModal = () => {
    setEditingTeacher(null);
    setForm(EMPTY_FORM);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (teacher: ITeacher) => {
    setEditingTeacher(teacher);
    setForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email ?? '',
      phone: teacher.phone ?? '',
      specialties: teacher.specialties.join(', '),
      levels: teacher.levels.join(', '),
      hourlyRate: String(teacher.hourlyRate),
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const input = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      specialties: toCommaList(form.specialties),
      levels: toCommaList(form.levels),
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
      paymentType: PaymentType.HOURLY,
    };

    try {
      if (editingTeacher) {
        await updateTeacher.mutateAsync(input);
      } else {
        await createTeacher.mutateAsync(input);
      }
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setEditingTeacher(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTeacher.mutateAsync(id);
  };

  const isSaving = createTeacher.isPending || updateTeacher.isPending;
  const teachers = data?.data ?? [];
  const avgHourlyRate = teachers.length
    ? Math.round(teachers.reduce((sum, teacher) => sum + teacher.hourlyRate, 0) / teachers.length)
    : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.teachers')}</h1>
        <Button onClick={openCreateModal}>{t('education.addTeacher')}</Button>
      </div>

      {!isLoading && teachers.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={Presentation}
            color="violet"
            label={t('education.totalTeachers')}
            value={teachers.length}
          />
          <StatCard
            icon={DollarSign}
            color="violet"
            label={t('education.avgHourlyRate')}
            value={avgHourlyRate}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && teachers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 text-violet-500">
            <Presentation size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noTeachersYet')}</p>
        </div>
      )}

      {!isLoading && teachers.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.fullName')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.teacherSpecialties')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.teacherPhone')}
                </th>
                <th className="p-3 text-end font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${teacher.firstName} ${teacher.lastName}`}
                        color="violet"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {teacher.firstName} {teacher.lastName}
                        </p>
                        {teacher.email && <p className="text-xs text-gray-500">{teacher.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">
                    {teacher.specialties.length > 0 ? teacher.specialties.join(', ') : '—'}
                  </td>
                  <td className="p-3 text-gray-600">{teacher.phone ?? '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditModal(teacher)}
                        title={t('common.edit')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(teacher.id)}
                        title={t('common.delete')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
        title={editingTeacher ? t('education.editTeacher') : t('education.addTeacher')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.teacherFirstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <Input
            label={t('education.teacherLastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <Input
            label={t('education.teacherEmail')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label={t('education.teacherPhone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label={t('education.teacherSpecialties')}
            value={form.specialties}
            onChange={(e) => setForm({ ...form, specialties: e.target.value })}
          />
          <Input
            label={t('education.teacherLevels')}
            value={form.levels}
            onChange={(e) => setForm({ ...form, levels: e.target.value })}
          />
          <Input
            label={t('education.teacherHourlyRate')}
            type="number"
            min="0"
            step="0.01"
            value={form.hourlyRate}
            onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
