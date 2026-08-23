'use client';

import { useState, FormEvent } from 'react';
import {
  ClipboardList,
  GraduationCap,
  BookOpen,
  Printer,
  Pencil,
} from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { InscriptionType } from '@smartcity/types';
import { useTeachers } from '@/lib/teachers';
import { useStudents } from '@/lib/students';
import {
  useOfferings,
  useCreateOffering,
  useUpdateOffering,
  type OfferingWithTeacher,
  type CreateOfferingInput,
} from '@/lib/offerings';
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

interface OfferingFormState {
  type: InscriptionType;
  name: string;
  description: string;
  duration: string;
  price: string;
  teacherId: string;
}

const EMPTY_OFFERING_FORM: OfferingFormState = {
  type: InscriptionType.SOUTIEN,
  name: '',
  description: '',
  duration: '',
  price: '',
  teacherId: '',
};

interface InscriptionFormState {
  studentId: string;
  offeringId: string;
  amount: string;
  method: string;
  otherMethod: string;
  note: string;
}

const EMPTY_INSCRIPTION_FORM: InscriptionFormState = {
  studentId: '',
  offeringId: '',
  amount: '',
  method: 'Espèces',
  otherMethod: '',
  note: '',
};

export default function InscriptionsPage() {
  const { t } = useTranslation();

  const { data: offeringsData, isLoading: isLoadingOfferings } = useOfferings(1, 100);
  const { data: teachersData } = useTeachers(1, 100);
  const { data: studentsData } = useStudents(1, 100);
  const { data: inscriptionsData, isLoading: isLoadingInscriptions } = useInscriptions(1, 100);

  const createOffering = useCreateOffering();
  const createInscription = useCreateInscription();

  const [isOfferingModalOpen, setIsOfferingModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<OfferingWithTeacher | null>(null);
  const [offeringForm, setOfferingForm] = useState<OfferingFormState>(EMPTY_OFFERING_FORM);
  const [offeringError, setOfferingError] = useState<string | null>(null);

  const updateOffering = useUpdateOffering(editingOffering?.id ?? '');

  const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
  const [inscriptionForm, setInscriptionForm] = useState<InscriptionFormState>(EMPTY_INSCRIPTION_FORM);
  const [inscriptionError, setInscriptionError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<CreatedInscription | null>(null);

  const openCreateOfferingModal = () => {
    setEditingOffering(null);
    setOfferingForm(EMPTY_OFFERING_FORM);
    setOfferingError(null);
    setIsOfferingModalOpen(true);
  };

  const openEditOfferingModal = (offering: OfferingWithTeacher) => {
    setEditingOffering(offering);
    setOfferingForm({
      type: offering.type,
      name: offering.name,
      description: offering.description ?? '',
      duration: offering.duration ?? '',
      price: String(offering.price),
      teacherId: offering.teacherId ?? '',
    });
    setOfferingError(null);
    setIsOfferingModalOpen(true);
  };

  const handleOfferingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setOfferingError(null);

    const input: CreateOfferingInput = {
      type: offeringForm.type,
      name: offeringForm.name,
      description: offeringForm.description || undefined,
      duration: offeringForm.duration || undefined,
      price: Number(offeringForm.price),
      teacherId: offeringForm.teacherId || undefined,
    };

    try {
      if (editingOffering) {
        await updateOffering.mutateAsync(input);
      } else {
        await createOffering.mutateAsync(input);
      }
      setIsOfferingModalOpen(false);
      setOfferingForm(EMPTY_OFFERING_FORM);
      setEditingOffering(null);
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const openCreateInscriptionModal = () => {
    setInscriptionForm(EMPTY_INSCRIPTION_FORM);
    setInscriptionError(null);
    setLastCreated(null);
    setIsInscriptionModalOpen(true);
  };

  const handleOfferingSelect = (offeringId: string) => {
    const offering = offerings.find((o) => o.id === offeringId);
    setInscriptionForm({
      ...inscriptionForm,
      offeringId,
      amount: offering ? String(offering.price) : inscriptionForm.amount,
    });
  };

  const handleInscriptionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setInscriptionError(null);

    const method =
      inscriptionForm.method === 'Autre' ? inscriptionForm.otherMethod : inscriptionForm.method;

    try {
      const created = await createInscription.mutateAsync({
        studentId: inscriptionForm.studentId,
        offeringId: inscriptionForm.offeringId,
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

  const offerings = offeringsData?.data ?? [];
  const inscriptions = inscriptionsData?.data ?? [];
  const soutienCount = inscriptions.filter((i) => i.offering.type === InscriptionType.SOUTIEN).length;
  const formationCount = inscriptions.filter((i) => i.offering.type === InscriptionType.FORMATION).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.inscriptions')}</h1>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('education.offerings')}</h2>
          <Button onClick={openCreateOfferingModal}>{t('education.addOffering')}</Button>
        </div>

        {isLoadingOfferings && <Skeleton height="4rem" />}

        {!isLoadingOfferings && offerings.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noOfferingsYet')}</p>
        )}

        {!isLoadingOfferings && offerings.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringName')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringType')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringPrice')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringDuration')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringTeacher')}
                  </th>
                  <th className="p-3 text-end font-medium text-gray-500">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((offering) => (
                  <tr key={offering.id} className="border-b border-gray-100 last:border-0 hover:bg-teal-50/30">
                    <td className="p-3 font-medium text-gray-900">{offering.name}</td>
                    <td className="p-3">
                      <Badge variant={offering.type === InscriptionType.SOUTIEN ? 'info' : 'success'}>
                        {t(TYPE_LABEL_KEY[offering.type])}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-600">{offering.price}</td>
                    <td className="p-3 text-gray-600">{offering.duration ?? '—'}</td>
                    <td className="p-3 text-gray-600">
                      {offering.teacher ? `${offering.teacher.firstName} ${offering.teacher.lastName}` : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEditOfferingModal(offering)}
                          title={t('common.edit')}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-sky-50 hover:text-sky-600"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('education.inscriptions')}</h2>
          <Button onClick={openCreateInscriptionModal}>{t('education.addInscription')}</Button>
        </div>

        {!isLoadingInscriptions && inscriptions.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <p className="text-sm text-gray-500">{t('education.noInscriptionsYet')}</p>
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
                    {t('education.inscriptionOffering')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.offeringType')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.inscriptionAmount')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.inscriptionMethod')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((inscription) => (
                  <tr key={inscription.id} className="border-b border-gray-100 last:border-0">
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
                    <td className="p-3 text-gray-600">{inscription.offering.name}</td>
                    <td className="p-3">
                      <Badge variant={inscription.offering.type === InscriptionType.SOUTIEN ? 'info' : 'success'}>
                        {t(TYPE_LABEL_KEY[inscription.offering.type])}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-600">{inscription.amount}</td>
                    <td className="p-3 text-gray-600">{inscription.payment.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isOfferingModalOpen}
        onClose={() => setIsOfferingModalOpen(false)}
        title={editingOffering ? t('education.editOffering') : t('education.addOffering')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsOfferingModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleOfferingSubmit}
              loading={createOffering.isPending || updateOffering.isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleOfferingSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t('education.offeringType')}</label>
            <select
              value={offeringForm.type}
              onChange={(e) => setOfferingForm({ ...offeringForm, type: e.target.value as InscriptionType })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={InscriptionType.SOUTIEN}>{t('education.typeSoutien')}</option>
              <option value={InscriptionType.FORMATION}>{t('education.typeFormation')}</option>
            </select>
          </div>
          <Input
            label={t('education.offeringName')}
            value={offeringForm.name}
            onChange={(e) => setOfferingForm({ ...offeringForm, name: e.target.value })}
            required
          />
          <Input
            label={t('education.offeringDescription')}
            value={offeringForm.description}
            onChange={(e) => setOfferingForm({ ...offeringForm, description: e.target.value })}
          />
          <Input
            label={t('education.offeringDuration')}
            value={offeringForm.duration}
            onChange={(e) => setOfferingForm({ ...offeringForm, duration: e.target.value })}
          />
          <Input
            label={t('education.offeringPrice')}
            type="number"
            min="0"
            step="0.01"
            value={offeringForm.price}
            onChange={(e) => setOfferingForm({ ...offeringForm, price: e.target.value })}
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t('education.offeringTeacher')}</label>
            <select
              value={offeringForm.teacherId}
              onChange={(e) => setOfferingForm({ ...offeringForm, teacherId: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">—</option>
              {(teachersData?.data ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </select>
          </div>
          {offeringError && <p className="text-sm text-red-600">{offeringError}</p>}
        </form>
      </Modal>

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
              <label className="text-sm font-medium text-gray-700">
                {t('education.inscriptionOffering')}
              </label>
              <select
                value={inscriptionForm.offeringId}
                onChange={(e) => handleOfferingSelect(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="" disabled>
                  —
                </option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {t(TYPE_LABEL_KEY[offering.type])} — {offering.name} ({offering.price})
                  </option>
                ))}
              </select>
            </div>
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
                {lastCreated.student.firstName} {lastCreated.student.lastName} — {lastCreated.offering.name}
              </p>
            </div>
            <div className="hidden print:block">
              <ThermalReceipt
                tenantName={lastCreated.tenantName}
                receiptId={lastCreated.id}
                date={new Date(lastCreated.date).toLocaleDateString()}
                studentName={`${lastCreated.student.firstName} ${lastCreated.student.lastName}`}
                offeringName={lastCreated.offering.name}
                method={lastCreated.method}
                amount={lastCreated.amount}
                thankYouLabel={t('education.receiptThankYou')}
                receiptLabel={t('education.receiptLabel')}
                dateLabel={t('education.receiptDate')}
                studentLabel={t('education.receiptStudent')}
                offeringLabel={t('education.receiptOffering')}
                methodLabel={t('education.receiptMethod')}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
