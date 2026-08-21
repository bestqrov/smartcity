'use client';

import { useState, FormEvent } from 'react';
import {
  Button,
  Input,
  Card,
  CardContent,
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.teachers')}</h1>
        <Button onClick={openCreateModal}>{t('education.addTeacher')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noTeachersYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((teacher) => (
            <Card key={teacher.id}>
              <CardContent>
                <p className="font-medium text-gray-900">
                  {teacher.firstName} {teacher.lastName}
                </p>
                {teacher.email && (
                  <p className="mt-1 text-sm text-gray-500">{teacher.email}</p>
                )}
                {teacher.phone && <p className="text-sm text-gray-500">{teacher.phone}</p>}
                {teacher.specialties.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    {teacher.specialties.join(', ')}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditModal(teacher)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(teacher.id)}
                    loading={deleteTeacher.isPending}
                  >
                    {t('common.delete')}
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
