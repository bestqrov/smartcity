'use client';

import { useState, FormEvent } from 'react';
import { UserCog, UserCheck, Users as UsersIcon, Ban } from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { useUsers, useCreateUser, useDeactivateUser, type ManagedRole } from '@/lib/users';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';

interface UserFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: ManagedRole;
}

const EMPTY_FORM: UserFormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'STAFF',
};

const ROLE_LABEL_KEY: Record<ManagedRole, string> = {
  MANAGER: 'education.roleManager',
  STAFF: 'education.roleStaff',
  ACCOUNTANT: 'education.roleAccountant',
};

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { data, isLoading } = useUsers(1, 100);
  const createUser = useCreateUser();
  const deactivateUser = useDeactivateUser();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createUser.mutateAsync({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        role: form.role,
      });
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm(t('education.confirmDeactivateUser'))) {
      return;
    }
    await deactivateUser.mutateAsync(id);
  };

  const users = data?.data ?? [];
  const activeCount = users.filter((u) => u.isActive).length;
  const managerCount = users.filter((u) => u.role === 'MANAGER').length;
  const staffCount = users.filter((u) => u.role === 'STAFF').length;
  const accountantCount = users.filter((u) => u.role === 'ACCOUNTANT').length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.users')}</h1>
        <Button onClick={openCreateModal}>{t('education.addUser')}</Button>
      </div>

      {!isLoading && users.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={UsersIcon}
            color="indigo"
            label={t('education.totalStaff')}
            value={users.length}
          />
          <StatCard
            icon={UserCheck}
            color="indigo"
            label={t('education.activeStaff')}
            value={activeCount}
          />
          <StatCard
            icon={UserCog}
            color="indigo"
            label={t('education.staffByRole')}
            value={`${managerCount} / ${staffCount} / ${accountantCount}`}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
            <UserCog size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noUsersYet')}</p>
        </div>
      )}

      {!isLoading && users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.fullName')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.userRole')}
                </th>
                <th className="p-3 text-start font-medium text-gray-500">
                  {t('education.userStatus')}
                </th>
                <th className="p-3 text-end font-medium text-gray-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((staffUser) => {
                const isSelf = staffUser.id === currentUser?.id;
                return (
                  <tr key={staffUser.id} className="border-b border-gray-100 last:border-0 hover:bg-indigo-50/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={`${staffUser.firstName} ${staffUser.lastName}`}
                          color="indigo"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {staffUser.firstName} {staffUser.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{staffUser.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">
                      {t(ROLE_LABEL_KEY[staffUser.role as ManagedRole] ?? staffUser.role)}
                    </td>
                    <td className="p-3">
                      <Badge variant={staffUser.isActive ? 'success' : 'default'}>
                        {staffUser.isActive
                          ? t('education.statusActive')
                          : t('education.statusInactive')}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleDeactivate(staffUser.id)}
                          disabled={isSelf || !staffUser.isActive}
                          title={isSelf ? t('education.cannotDeactivateSelf') : t('education.deactivateUser')}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <Ban size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addUser')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createUser.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.userFirstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <Input
            label={t('education.userLastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <Input
            label={t('education.userEmail')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label={t('education.userPassword')}
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <Input
            label={t('education.userPhone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.userRole')}
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as ManagedRole })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="MANAGER">{t('education.roleManager')}</option>
              <option value="STAFF">{t('education.roleStaff')}</option>
              <option value="ACCOUNTANT">{t('education.roleAccountant')}</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
