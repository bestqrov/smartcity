'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Users, Phone, Eye, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
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
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';

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
  const guardians = data?.data ?? [];
  const withPhoneCount = guardians.filter((g) => g.phone).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.guardians')}</h1>
        <Button onClick={openCreateModal}>{t('education.addGuardian')}</Button>
      </div>

      {!isLoading && guardians.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={Users}
            color="amber"
            label={t('education.totalGuardians')}
            value={guardians.length}
          />
          <StatCard
            icon={Phone}
            color="amber"
            label={t('education.guardiansWithPhone')}
            value={withPhoneCount}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && guardians.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Users size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noGuardiansYet')}</p>
        </div>
      )}

      {!isLoading && guardians.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.fullName')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.guardianEmail')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.guardianPhone')}
                </th>
                <th className="p-3 text-end font-medium text-gray-500">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {guardians.map((guardian) => (
                <tr key={guardian.id} className="border-b border-gray-100 last:border-0 hover:bg-amber-50/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${guardian.firstName} ${guardian.lastName}`}
                        color="amber"
                      />
                      <span className="font-medium text-gray-900">
                        {guardian.firstName} {guardian.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{guardian.email ?? '—'}</td>
                  <td className="p-3 text-gray-600">{guardian.phone ?? '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setViewingStudentsFor(guardian)}
                        title={t('education.linkedStudents')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-amber-50 hover:text-amber-600"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(guardian)}
                        title={t('common.edit')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(guardian.id)}
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
