'use client';

import { useState, FormEvent } from 'react';
import { Award, ClipboardList, TrendingUp, Calendar, Pencil, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Skeleton } from '@smartcity/ui';
import { InscriptionType } from '@smartcity/types';
import { useStudents } from '@/lib/students';
import { useCreateInscription } from '@/lib/inscriptions';
import {
  useFormations,
  useCreateFormation,
  useUpdateFormation,
  useDeleteFormation,
  useFormationAnalytics,
  type CreateFormationInput,
} from '@/lib/formations';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';

interface FormationFormState {
  name: string;
  duration: string;
  price: string;
  description: string;
}

const EMPTY_FORMATION_FORM: FormationFormState = {
  name: '',
  duration: '',
  price: '',
  description: '',
};

const PAYMENT_METHODS = [
  { value: 'Espèces', labelKey: 'education.methodCash' },
  { value: 'Carte bancaire', labelKey: 'education.methodCard' },
  { value: 'Virement bancaire', labelKey: 'education.methodTransfer' },
  { value: 'Chèque', labelKey: 'education.methodCheck' },
  { value: 'Autre', labelKey: 'education.methodOther' },
] as const;

interface EnrollFormState {
  studentId: string;
  formationId: string;
  method: string;
  otherMethod: string;
}

const EMPTY_ENROLL_FORM: EnrollFormState = {
  studentId: '',
  formationId: '',
  method: 'Espèces',
  otherMethod: '',
};

export default function FormationsPage() {
  const { t } = useTranslation();

  const { data: formationsData, isLoading: isLoadingFormations } = useFormations(1, 100);
  const { data: analytics } = useFormationAnalytics();
  const { data: studentsData } = useStudents(1, 100);

  const createFormation = useCreateFormation();
  const deleteFormation = useDeleteFormation();
  const createInscription = useCreateInscription();

  const [isFormationModalOpen, setIsFormationModalOpen] = useState(false);
  const [editingFormationId, setEditingFormationId] = useState<string | null>(null);
  const [formationForm, setFormationForm] = useState<FormationFormState>(EMPTY_FORMATION_FORM);
  const [formationError, setFormationError] = useState<string | null>(null);

  const updateFormation = useUpdateFormation(editingFormationId ?? '');

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState<EnrollFormState>(EMPTY_ENROLL_FORM);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const openCreateFormationModal = () => {
    setEditingFormationId(null);
    setFormationForm(EMPTY_FORMATION_FORM);
    setFormationError(null);
    setIsFormationModalOpen(true);
  };

  const openEditFormationModal = (formation: { id: string; name: string; duration: string; price: number; description?: string }) => {
    setEditingFormationId(formation.id);
    setFormationForm({
      name: formation.name,
      duration: formation.duration,
      price: String(formation.price),
      description: formation.description ?? '',
    });
    setFormationError(null);
    setIsFormationModalOpen(true);
  };

  const handleFormationSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormationError(null);

    const input: CreateFormationInput = {
      name: formationForm.name,
      duration: formationForm.duration,
      price: Number(formationForm.price),
      description: formationForm.description || undefined,
    };

    try {
      if (editingFormationId) {
        await updateFormation.mutateAsync(input);
      } else {
        await createFormation.mutateAsync(input);
      }
      setIsFormationModalOpen(false);
      setFormationForm(EMPTY_FORMATION_FORM);
      setEditingFormationId(null);
    } catch (err) {
      setFormationError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDeleteFormation = async (id: string) => {
    await deleteFormation.mutateAsync(id);
  };

  const openEnrollModal = () => {
    setEnrollForm(EMPTY_ENROLL_FORM);
    setEnrollError(null);
    setIsEnrollModalOpen(true);
  };

  const handleEnrollSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setEnrollError(null);

    const formation = formations.find((f) => f.id === enrollForm.formationId);
    if (!formation) {
      setEnrollError(t('common.error'));
      return;
    }

    const method = enrollForm.method === 'Autre' ? enrollForm.otherMethod : enrollForm.method;

    try {
      await createInscription.mutateAsync({
        studentId: enrollForm.studentId,
        type: InscriptionType.FORMATION,
        category: formation.name,
        amount: formation.price,
        method,
        note: `Inscription Formation: ${formation.name}`,
      });
      setIsEnrollModalOpen(false);
      setEnrollForm(EMPTY_ENROLL_FORM);
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const formations = formationsData?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.formations')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEnrollModal}>
            {t('education.enrollStudent')}
          </Button>
          <Button onClick={openCreateFormationModal}>{t('education.addFormation')}</Button>
        </div>
      </div>

      {analytics && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard
            icon={Award}
            color="orange"
            label={t('education.totalFormations')}
            value={analytics.totalFormations}
          />
          <StatCard
            icon={ClipboardList}
            color="orange"
            label={t('education.totalFormationInscriptions')}
            value={analytics.totalInscriptions}
          />
          <StatCard
            icon={TrendingUp}
            color="orange"
            label={t('education.totalFormationRevenue')}
            value={analytics.totalRevenue}
          />
          <StatCard
            icon={Calendar}
            color="orange"
            label={t('education.monthlyFormationRevenue')}
            value={analytics.monthlyRevenue}
          />
        </div>
      )}

      {isLoadingFormations && <Skeleton height="4rem" />}

      {!isLoadingFormations && formations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <Award size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noFormationsYet')}</p>
        </div>
      )}

      {!isLoadingFormations && formations.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationName')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationDuration')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationPrice')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.formationDescription')}
                </th>
                <th className="p-3 text-end font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {formations.map((formation) => (
                <tr key={formation.id} className="border-b border-gray-100 last:border-0 hover:bg-orange-50/30">
                  <td className="p-3 font-medium text-gray-900">{formation.name}</td>
                  <td className="p-3 text-gray-600">{formation.duration}</td>
                  <td className="p-3 text-gray-600">{formation.price}</td>
                  <td className="p-3 text-gray-600">{formation.description ?? '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditFormationModal(formation)}
                        title={t('common.edit')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteFormation(formation.id)}
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
        open={isFormationModalOpen}
        onClose={() => setIsFormationModalOpen(false)}
        title={editingFormationId ? t('education.editFormation') : t('education.addFormation')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsFormationModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleFormationSubmit}
              loading={createFormation.isPending || updateFormation.isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormationSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.formationName')}
            value={formationForm.name}
            onChange={(e) => setFormationForm({ ...formationForm, name: e.target.value })}
            required
          />
          <Input
            label={t('education.formationDuration')}
            value={formationForm.duration}
            onChange={(e) => setFormationForm({ ...formationForm, duration: e.target.value })}
            required
          />
          <Input
            label={t('education.formationPrice')}
            type="number"
            min="0"
            step="0.01"
            value={formationForm.price}
            onChange={(e) => setFormationForm({ ...formationForm, price: e.target.value })}
            required
          />
          <Input
            label={t('education.formationDescription')}
            value={formationForm.description}
            onChange={(e) => setFormationForm({ ...formationForm, description: e.target.value })}
          />
          {formationError && <p className="text-sm text-red-600">{formationError}</p>}
        </form>
      </Modal>

      <Modal
        open={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title={t('education.enrollStudent')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEnrollModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEnrollSubmit} loading={createInscription.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleEnrollSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.enrollStudentField')}
            </label>
            <select
              value={enrollForm.studentId}
              onChange={(e) => setEnrollForm({ ...enrollForm, studentId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {(studentsData?.data ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName} ({student.registrationNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.enrollFormation')}
            </label>
            <select
              value={enrollForm.formationId}
              onChange={(e) => setEnrollForm({ ...enrollForm, formationId: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {formations.map((formation) => (
                <option key={formation.id} value={formation.id}>
                  {formation.name} ({formation.price})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.inscriptionMethod')}
            </label>
            <select
              value={enrollForm.method}
              onChange={(e) => setEnrollForm({ ...enrollForm, method: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(m.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {enrollForm.method === 'Autre' && (
            <Input
              label={t('education.inscriptionMethodOther')}
              value={enrollForm.otherMethod}
              onChange={(e) => setEnrollForm({ ...enrollForm, otherMethod: e.target.value })}
              required
            />
          )}
          {enrollError && <p className="text-sm text-red-600">{enrollError}</p>}
        </form>
      </Modal>
    </div>
  );
}
