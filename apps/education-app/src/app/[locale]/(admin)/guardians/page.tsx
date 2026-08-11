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
import type { IGuardian } from '@smartcity/types';
import {
  useGuardians,
  useGuardianStudents,
  useCreateGuardian,
  useUpdateGuardian,
  useDeleteGuardian,
} from '@/lib/guardians';
import { useTranslation } from '@/lib/i18n';

interface GuardianFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: GuardianFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

export default function GuardiansPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { data, isLoading } = useGuardians();
  const createGuardian = useCreateGuardian();
  const deleteGuardian = useDeleteGuardian();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<IGuardian | null>(null);
  const [form, setForm] = useState<GuardianFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [viewingStudentsFor, setViewingStudentsFor] = useState<IGuardian | null>(null);
  const { data: linkedStudents, isLoading: isLoadingLinkedStudents } =
    useGuardianStudents(viewingStudentsFor?.id);

  const updateGuardian = useUpdateGuardian(editingGuardian?.id ?? '');

  const openCreateModal = () => {
    setEditingGuardian(null);
    setForm(EMPTY_FORM);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (guardian: IGuardian) => {
    setEditingGuardian(guardian);
    setForm({
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      email: guardian.email ?? '',
      phone: guardian.phone ?? '',
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
    };

    try {
      if (editingGuardian) {
        await updateGuardian.mutateAsync(input);
      } else {
        await createGuardian.mutateAsync(input);
      }
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setEditingGuardian(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteGuardian.mutateAsync(id);
  };

  const isSaving = createGuardian.isPending || updateGuardian.isPending;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.guardians')}</h1>
        <Button onClick={openCreateModal}>{t('education.addGuardian')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noGuardiansYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((guardian) => (
            <Card key={guardian.id}>
              <CardContent>
                <p className="font-medium text-gray-900">
                  {guardian.firstName} {guardian.lastName}
                </p>
                {guardian.email && (
                  <p className="mt-1 text-sm text-gray-500">{guardian.email}</p>
                )}
                {guardian.phone && (
                  <p className="text-sm text-gray-500">{guardian.phone}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewingStudentsFor(guardian)}>
                    {t('education.linkedStudents')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEditModal(guardian)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(guardian.id)}
                    loading={deleteGuardian.isPending}
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
        title={editingGuardian ? t('education.editGuardian') : t('education.addGuardian')}
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
            label={t('education.guardianFirstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <Input
            label={t('education.guardianLastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <Input
            label={t('education.guardianEmail')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label={t('education.guardianPhone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>

      <Modal
        open={!!viewingStudentsFor}
        onClose={() => setViewingStudentsFor(null)}
        title={
          viewingStudentsFor
            ? `${t('education.linkedStudents')} — ${viewingStudentsFor.firstName} ${viewingStudentsFor.lastName}`
            : t('education.linkedStudents')
        }
      >
        {isLoadingLinkedStudents && <Skeleton height="3rem" />}
        {!isLoadingLinkedStudents && linkedStudents?.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noGuardiansLinkedYet')}</p>
        )}
        {!isLoadingLinkedStudents && linkedStudents && linkedStudents.length > 0 && (
          <ul className="flex flex-col gap-2">
            {linkedStudents.map((link) => (
              <li key={link.relationship.id}>
                <Link
                  href={`/${locale}/students/${link.student.id}`}
                  className="text-primary-700 hover:underline"
                >
                  {link.student.firstName} {link.student.lastName} ({link.student.registrationNumber})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
