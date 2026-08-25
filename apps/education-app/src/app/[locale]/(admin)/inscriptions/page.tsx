'use client';

import { useState, FormEvent } from 'react';
import { ClipboardList, GraduationCap, BookOpen, Printer } from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { InscriptionType } from '@smartcity/types';
import { useStudents } from '@/lib/students';
import {
  useInscriptions,
  useCreateInscription,
  type CreatedInscription,
} from '@/lib/inscriptions';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';
import { ThermalReceipt } from '@/components/ThermalReceipt';

const PAYMENT_METHODS = [
  { value: 'Espèces', labelKey: 'education.methodCash' },
  { value: 'Carte bancaire', labelKey: 'education.methodCard' },
  { value: 'Virement bancaire', labelKey: 'education.methodTransfer' },
  { value: 'Chèque', labelKey: 'education.methodCheck' },
  { value: 'Autre', labelKey: 'education.methodOther' },
] as const;

const TYPE_LABEL_KEY: Record<InscriptionType, string> = {
  [InscriptionType.SOUTIEN]: 'education.typeSoutien',
  [InscriptionType.FORMATION]: 'education.typeFormation',
};

const SOUTIEN_CATEGORIES = [
  { value: 'math', labelKey: 'education.categoryMath' },
  { value: 'physique', labelKey: 'education.categoryPhysique' },
  { value: 'svt', labelKey: 'education.categorySvt' },
  { value: 'francais', labelKey: 'education.categoryFrancais' },
  { value: 'anglais', labelKey: 'education.categoryAnglais' },
  { value: 'calcul_mental', labelKey: 'education.categoryCalculMental' },
  { value: 'couran', labelKey: 'education.categoryCouran' },
  { value: 'autre', labelKey: 'education.categoryAutre' },
] as const;

const FORMATION_CATEGORIES = [
  { value: 'coiffure', labelKey: 'education.categoryCoiffure' },
  { value: 'bureautique', labelKey: 'education.categoryBureautique' },
  { value: 'ecommerce', labelKey: 'education.categoryEcommerce' },
  { value: 'autre', labelKey: 'education.categoryAutre' },
] as const;

interface InscriptionFormState {
  studentId: string;
  type: InscriptionType;
  category: string;
  otherCategory: string;
  amount: string;
  method: string;
  otherMethod: string;
  note: string;
}

const EMPTY_INSCRIPTION_FORM: InscriptionFormState = {
  studentId: '',
  type: InscriptionType.SOUTIEN,
  category: 'math',
  otherCategory: '',
  amount: '',
  method: 'Espèces',
  otherMethod: '',
  note: '',
};

export default function InscriptionsPage() {
  const { t } = useTranslation();

  const { data: studentsData } = useStudents(1, 100);
  const { data: inscriptionsData, isLoading: isLoadingInscriptions } = useInscriptions(1, 100);

  const createInscription = useCreateInscription();

  const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
  const [inscriptionForm, setInscriptionForm] = useState<InscriptionFormState>(EMPTY_INSCRIPTION_FORM);
  const [inscriptionError, setInscriptionError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<CreatedInscription | null>(null);

  const openCreateInscriptionModal = () => {
    setInscriptionForm(EMPTY_INSCRIPTION_FORM);
    setInscriptionError(null);
    setLastCreated(null);
    setIsInscriptionModalOpen(true);
  };

  const handleTypeChange = (type: InscriptionType) => {
    const defaultCategory = type === InscriptionType.SOUTIEN ? 'math' : 'coiffure';
    setInscriptionForm({ ...inscriptionForm, type, category: defaultCategory, otherCategory: '' });
  };

  const handleInscriptionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setInscriptionError(null);

    const category =
      inscriptionForm.category === 'autre' ? inscriptionForm.otherCategory : inscriptionForm.category;
    const method =
      inscriptionForm.method === 'Autre' ? inscriptionForm.otherMethod : inscriptionForm.method;

    try {
      const created = await createInscription.mutateAsync({
        studentId: inscriptionForm.studentId,
        type: inscriptionForm.type,
        category,
        amount: Number(inscriptionForm.amount),
        method,
        note: inscriptionForm.note || undefined,
      });
      setLastCreated(created);
    } catch (err) {
      setInscriptionError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const inscriptions = inscriptionsData?.data ?? [];
  const soutienCount = inscriptions.filter((i) => i.type === InscriptionType.SOUTIEN).length;
  const formationCount = inscriptions.filter((i) => i.type === InscriptionType.FORMATION).length;

  const categoryOptions =
    inscriptionForm.type === InscriptionType.SOUTIEN ? SOUTIEN_CATEGORIES : FORMATION_CATEGORIES;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.inscriptions')}</h1>
        <Button onClick={openCreateInscriptionModal}>{t('education.addInscription')}</Button>
      </div>

      {!isLoadingInscriptions && inscriptions.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={ClipboardList}
            color="teal"
            label={t('education.totalInscriptions')}
            value={inscriptions.length}
          />
          <StatCard
            icon={GraduationCap}
            color="teal"
            label={t('education.soutienInscriptions')}
            value={soutienCount}
          />
          <StatCard
            icon={BookOpen}
            color="teal"
            label={t('education.formationInscriptions')}
            value={formationCount}
          />
        </div>
      )}

      {isLoadingInscriptions && <Skeleton height="4rem" />}

      {!isLoadingInscriptions && inscriptions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-500">
            <ClipboardList size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noInscriptionsYet')}</p>
        </div>
      )}

      {!isLoadingInscriptions && inscriptions.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionStudent')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionType')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionCategory')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.inscriptionAmount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {inscriptions.map((inscription) => (
                <tr key={inscription.id} className="border-b border-gray-100 last:border-0 hover:bg-teal-50/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${inscription.student.firstName} ${inscription.student.lastName}`}
                        color="indigo"
                      />
                      <span className="font-medium text-gray-900">
                        {inscription.student.firstName} {inscription.student.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={inscription.type === InscriptionType.SOUTIEN ? 'info' : 'success'}>
                      {t(TYPE_LABEL_KEY[inscription.type])}
                    </Badge>
                  </td>
                  <td className="p-3 text-gray-600">{inscription.category}</td>
                  <td className="p-3 text-gray-600">{inscription.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isInscriptionModalOpen}
        onClose={() => setIsInscriptionModalOpen(false)}
        title={t('education.addInscription')}
        footer={
          lastCreated ? (
            <>
              <Button variant="outline" onClick={() => setIsInscriptionModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handlePrint}>
                <Printer size={16} className="me-2" />
                {t('education.printReceipt')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsInscriptionModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleInscriptionSubmit} loading={createInscription.isPending}>
                {t('common.save')}
              </Button>
            </>
          )
        }
      >
        {!lastCreated && (
          <form onSubmit={handleInscriptionSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionStudent')}
              </label>
              <select
                value={inscriptionForm.studentId}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, studentId: e.target.value })}
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
              <label className="text-sm font-medium text-gray-700">{t('education.inscriptionType')}</label>
              <select
                value={inscriptionForm.type}
                onChange={(e) => handleTypeChange(e.target.value as InscriptionType)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={InscriptionType.SOUTIEN}>{t('education.typeSoutien')}</option>
                <option value={InscriptionType.FORMATION}>{t('education.typeFormation')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionCategory')}
              </label>
              <select
                value={inscriptionForm.category}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, category: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            {inscriptionForm.category === 'autre' && (
              <Input
                label={t('education.inscriptionCategory')}
                value={inscriptionForm.otherCategory}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, otherCategory: e.target.value })}
                required
              />
            )}
            <Input
              label={t('education.inscriptionAmount')}
              type="number"
              min="0.01"
              step="0.01"
              value={inscriptionForm.amount}
              onChange={(e) => setInscriptionForm({ ...inscriptionForm, amount: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionMethod')}
              </label>
              <select
                value={inscriptionForm.method}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, method: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            {inscriptionForm.method === 'Autre' && (
              <Input
                label={t('education.inscriptionMethodOther')}
                value={inscriptionForm.otherMethod}
                onChange={(e) => setInscriptionForm({ ...inscriptionForm, otherMethod: e.target.value })}
                required
              />
            )}
            <Input
              label={t('education.inscriptionNote')}
              value={inscriptionForm.note}
              onChange={(e) => setInscriptionForm({ ...inscriptionForm, note: e.target.value })}
            />
            {inscriptionError && <p className="text-sm text-red-600">{inscriptionError}</p>}
          </form>
        )}

        {lastCreated && (
          <>
            <div className="print:hidden">
              <p className="text-sm text-gray-600">
                {lastCreated.student.firstName} {lastCreated.student.lastName} — {t(TYPE_LABEL_KEY[lastCreated.type])}: {lastCreated.category}
              </p>
            </div>
            <div className="hidden print:block">
              <ThermalReceipt
                tenantName={lastCreated.tenantName}
                receiptId={lastCreated.id}
                date={new Date(lastCreated.date).toLocaleDateString()}
                studentName={`${lastCreated.student.firstName} ${lastCreated.student.lastName}`}
                itemLabel={`${t(TYPE_LABEL_KEY[lastCreated.type])} — ${lastCreated.category}`}
                method={lastCreated.method}
                amount={lastCreated.amount}
                thankYouLabel={t('education.receiptThankYou')}
                receiptLabel={t('education.receiptLabel')}
                dateLabel={t('education.receiptDate')}
                studentLabel={t('education.receiptStudent')}
                itemFieldLabel={t('education.receiptItem')}
                methodLabel={t('education.receiptMethod')}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
