'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  tenantId: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'STAFF', 'GUEST'];

export function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    const query = roleFilter ? `?role=${encodeURIComponent(roleFilter)}` : '';
    apiClient(`/users${query}`)
      .then((response) => setUsers(response.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await apiClient(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t('admin.users')}</h1>
        <div>
          <label className="sr-only">{t('hotels.filterByType')}</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('hotels.allTypes')}</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.users')} ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">{t('myBookings.guest')}</th>
                  <th className="text-left py-2 px-3">{t('admin.email')}</th>
                  <th className="text-left py-2 px-3">{t('admin.role')}</th>
                  <th className="text-left py-2 px-3">{t('myBookings.status')}</th>
                  <th className="text-right py-2 px-3">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-3 px-3">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-600">{user.email}</td>
                    <td className="py-3 px-3">{user.role}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
                      >
                        {user.isActive ? t('admin.statusActive') : t('admin.statusInactive')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant={user.isActive ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => handleToggleActive(user.id, user.isActive)}
                      >
                        {user.isActive ? t('admin.deactivate') : t('admin.activate')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
