'use client';

import { useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { GuardianRelationshipType } from '@smartcity/types';
import { useStudent } from '@/lib/students';
import { useStudentAttendance } from '@/lib/attendance';
import { useGuardians, useCreateGuardian } from '@/lib/guardians';
import {
  useStudentGuardians,
  useCreateStudentGuardian,
  useUpdateStudentGuardian,
  useRemoveStudentGuardian,
  type StudentGuardianWithGuardian,
  type UpdateStudentGuardianInput,
} from '@/lib/student-guardians';
import { useTranslation } from '@/lib/i18n';

const RELATIONSHIP_LABEL_KEY: Record<GuardianRelationshipType, string> = {
  [GuardianRelationshipType.MOTHER]: 'education.relationshipMother',
  [GuardianRelationshipType.FATHER]: 'education.relationshipFather',
  [GuardianRelationshipType.GUARDIAN]: 'education.relationshipGuardian',
  [GuardianRelationshipType.OTHER]: 'education.relationshipOther',
};

const RELATIONSHIP_METADATA_FIELDS: Array<{
  key: keyof UpdateStudentGuardianInput;
  labelKey: string;
}> = [
  { key: 'isPrimary', labelKey: 'education.isPrimary' },
  { key: 'isEmergencyContact', labelKey: 'education.isEmergencyContact' },
  { key: 'canPickUp', labelKey: 'education.canPickUp' },
  { key: 'canCommunicate', labelKey: 'education.canCommunicate' },
  { key: 'financiallyResponsible', labelKey: 'education.financiallyResponsible' },
];

const ATTENDANCE_STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
  PRESENT: 'success',
  ABSENT: 'error',
  LATE: 'warning',
  EXCUSED: 'info',
};

const ATTENDANCE_STATUS_LABEL_KEY: Record<string, string> = {
  PRESENT: 'education.statusPresent',
  ABSENT: 'education.statusAbsent',
  LATE: 'education.statusLate',
  EXCUSED: 'education.statusExcused',
};

export default function StudentDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const studentId = params?.id as string;

  const { data: student, isLoading: isLoadingStudent } = useStudent(studentId);
  const { data: links, isLoading: isLoadingLinks } = useStudentGuardians(studentId);
  const { data: attendanceHistory, isLoading: isLoadingAttendance } =
    useStudentAttendance(studentId);
  const { data: guardiansData } = useGuardians(1, 100);

  const createGuardian = useCreateGuardian();
  const createLink = useCreateStudentGuardian();
  const updateLink = useUpdateStudentGuardian(studentId);
  const removeLink = useRemoveStudentGuardian(studentId);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [newGuardianFirstName, setNewGuardianFirstName] = useState('');
  const [newGuardianLastName, setNewGuardianLastName] = useState('');
  const [newGuardianEmail, setNewGuardianEmail] = useState('');
  const [newGuardianPhone, setNewGuardianPhone] = useState('');
  const [relationshipType, setRelationshipType] = useState<GuardianRelationshipType | ''>('');
  const [metadata, setMetadata] = useState<UpdateStudentGuardianInput>({});
  const [addError, setAddError] = useState<string | null>(null);

  const [editingLink, setEditingLink] = useState<StudentGuardianWithGuardian | null>(null);
  const [editMetadata, setEditMetadata] = useState<UpdateStudentGuardianInput>({});

  const resetAddForm = () => {
    setAddMode('existing');
    setSelectedGuardianId('');
    setNewGuardianFirstName('');
    setNewGuardianLastName('');
    setNewGuardianEmail('');
    setNewGuardianPhone('');
    setRelationshipType('');
    setMetadata({});
    setAddError(null);
  };

  const openAddModal = () => {
    resetAddForm();
    setIsAddModalOpen(true);
  };

  const handleAddGuardian = async (event: FormEvent) => {
    event.preventDefault();
    setAddError(null);

    if (!relationshipType) {
      setAddError(t('education.relationshipType'));
      return;
    }

    try {
      let guardianId = selectedGuardianId;

      if (addMode === 'new') {
        const newGuardian = await createGuardian.mutateAsync({
          firstName: newGuardianFirstName,
          lastName: newGuardianLastName,
          email: newGuardianEmail || undefined,
          phone: newGuardianPhone || undefined,
        });
        guardianId = newGuardian.id;
      }

      await createLink.mutateAsync({
        studentId,
        guardianId,
        relationshipType,
        ...metadata,
      });

      setIsAddModalOpen(false);
      resetAddForm();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const openEditModal = (link: StudentGuardianWithGuardian) => {
    setEditingLink(link);
    setEditMetadata({
      relationshipType: link.relationshipType,
      isPrimary: link.isPrimary,
      isEmergencyContact: link.isEmergencyContact,
      canPickUp: link.canPickUp,
      canCommunicate: link.canCommunicate,
      financiallyResponsible: link.financiallyResponsible,
    });
  };

  const handleUpdateRelationship = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingLink) return;
    await updateLink.mutateAsync({ id: editingLink.id, input: editMetadata });
    setEditingLink(null);
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm(t('education.confirmRemoveGuardian'))) return;
    await removeLink.mutateAsync(id);
  };

  const existingGuardianIds = new Set((links ?? []).map((l) => l.guardianId));
  const availableGuardians = (guardiansData?.data ?? []).filter(
    (g) => !existingGuardianIds.has(g.id),
  );

  if (isLoadingStudent) {
    return <Skeleton height="6rem" />;
  }

  if (!student) {
    return <p className="text-sm text-gray-500">{t('education.studentDetails')}</p>;
  }

  return (
    <div>
      <Link href={`/${locale}/students`} className="text-sm text-primary-700 hover:underline">
        &larr; {t('education.backToStudents')}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {student.firstName} {student.lastName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{student.registrationNumber}</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t('education.studentGuardians')}</h2>
        <Button onClick={openAddModal}>{t('education.addGuardian')}</Button>
      </div>

      {isLoadingLinks && <Skeleton height="4rem" />}

      {!isLoadingLinks && links?.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noGuardiansLinkedYet')}</p>
      )}

      {!isLoadingLinks && links && links.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent>
                <p className="font-medium text-gray-900">
                  {link.guardian.firstName} {link.guardian.lastName}
                </p>
                <Badge variant="info" className="mt-1">
                  {t(RELATIONSHIP_LABEL_KEY[link.relationshipType])}
                </Badge>
                <div className="mt-2 flex flex-wrap gap-1">
                  {link.isPrimary && <Badge variant="success">{t('education.isPrimary')}</Badge>}
                  {link.isEmergencyContact && (
                    <Badge variant="warning">{t('education.isEmergencyContact')}</Badge>
                  )}
                  {link.canPickUp && <Badge>{t('education.canPickUp')}</Badge>}
                  {link.financiallyResponsible && (
                    <Badge>{t('education.financiallyResponsible')}</Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditModal(link)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemove(link.id)}
                    loading={removeLink.isPending}
                  >
                    {t('education.removeGuardian')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('education.addGuardian')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAddGuardian}
              loading={createGuardian.isPending || createLink.isPending}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddGuardian} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={addMode === 'existing' ? 'primary' : 'outline'}
              onClick={() => setAddMode('existing')}
            >
              {t('education.addExistingGuardian')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={addMode === 'new' ? 'primary' : 'outline'}
              onClick={() => setAddMode('new')}
            >
              {t('education.createNewGuardian')}
            </Button>
          </div>

          {addMode === 'existing' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('education.selectGuardian')}
              </label>
              <select
                value={selectedGuardianId}
                onChange={(e) => setSelectedGuardianId(e.target.value)}
                required={addMode === 'existing'}
                className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="" disabled>
                  —
                </option>
                {availableGuardians.map((guardian) => (
                  <option key={guardian.id} value={guardian.id}>
                    {guardian.firstName} {guardian.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {addMode === 'new' && (
            <>
              <Input
                label={t('education.guardianFirstName')}
                value={newGuardianFirstName}
                onChange={(e) => setNewGuardianFirstName(e.target.value)}
                required={addMode === 'new'}
              />
              <Input
                label={t('education.guardianLastName')}
                value={newGuardianLastName}
                onChange={(e) => setNewGuardianLastName(e.target.value)}
                required={addMode === 'new'}
              />
              <Input
                label={t('education.guardianEmail')}
                type="email"
                value={newGuardianEmail}
                onChange={(e) => setNewGuardianEmail(e.target.value)}
              />
              <Input
                label={t('education.guardianPhone')}
                value={newGuardianPhone}
                onChange={(e) => setNewGuardianPhone(e.target.value)}
              />
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.relationshipType')}
            </label>
            <select
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as GuardianRelationshipType)
              }
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="" disabled>
                —
              </option>
              {Object.values(GuardianRelationshipType).map((value) => (
                <option key={value} value={value}>
                  {t(RELATIONSHIP_LABEL_KEY[value])}
                </option>
              ))}
            </select>
          </div>

          {RELATIONSHIP_METADATA_FIELDS.map(({ key, labelKey }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!metadata[key]}
                onChange={(e) => setMetadata({ ...metadata, [key]: e.target.checked })}
                className="rounded border-gray-300"
              />
              {t(labelKey)}
            </label>
          ))}

          {addError && <p className="text-sm text-red-600">{addError}</p>}
        </form>
      </Modal>

      <Modal
        open={!!editingLink}
        onClose={() => setEditingLink(null)}
        title={t('education.relationshipType')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingLink(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateRelationship} loading={updateLink.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateRelationship} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.relationshipType')}
            </label>
            <select
              value={editMetadata.relationshipType ?? ''}
              onChange={(e) =>
                setEditMetadata({
                  ...editMetadata,
                  relationshipType: e.target.value as GuardianRelationshipType,
                })
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.values(GuardianRelationshipType).map((value) => (
                <option key={value} value={value}>
                  {t(RELATIONSHIP_LABEL_KEY[value])}
                </option>
              ))}
            </select>
          </div>

          {RELATIONSHIP_METADATA_FIELDS.map(({ key, labelKey }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={!!editMetadata[key]}
                onChange={(e) =>
                  setEditMetadata({ ...editMetadata, [key]: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              {t(labelKey)}
            </label>
          ))}
        </form>
      </Modal>

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t('education.attendanceHistory')}
        </h2>

        {isLoadingAttendance && <Skeleton height="4rem" />}

        {!isLoadingAttendance && attendanceHistory?.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noAttendanceRecordsYet')}</p>
        )}

        {!isLoadingAttendance && attendanceHistory && attendanceHistory.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.selectDate')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.groups')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.studentStatus')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3 text-gray-600">
                      {new Date(record.date).toLocaleDateString(locale)}
                    </td>
                    <td className="p-3 text-gray-600">{record.group.name}</td>
                    <td className="p-3">
                      <Badge variant={ATTENDANCE_STATUS_VARIANT[record.status] ?? 'default'}>
                        {t(ATTENDANCE_STATUS_LABEL_KEY[record.status] ?? record.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
