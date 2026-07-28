'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billingPeriod: 'MONTHLY' | 'YEARLY';
  features: string[];
  isActive: boolean;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
  tenant: Tenant;
}

const STATUS_STYLES: Record<string, string> = {
  TRIALING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
  EXPIRED: 'bg-red-100 text-red-700',
};

export default function AdminBillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { user } = useAuth();
  const { t } = useTranslation();

  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [planForm, setPlanForm] = React.useState({ name: '', slug: '', price: '', features: '' });
  const [subForm, setSubForm] = React.useState({ tenantId: '', planId: '' });
  const [submitting, setSubmitting] = React.useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const fetchAll = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient('/plans?includeInactive=true'),
      apiClient('/tenants?limit=100'),
      apiClient('/subscriptions'),
    ])
      .then(([plansRes, tenantsRes, subsRes]) => {
        setPlans(plansRes || []);
        setTenants(tenantsRes.data || []);
        setSubscriptions(subsRes || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  React.useEffect(() => {
    if (isSuperAdmin) fetchAll();
    else setLoading(false);
  }, [isSuperAdmin, fetchAll]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient('/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: planForm.name,
          slug: planForm.slug,
          price: Number(planForm.price),
          features: planForm.features
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean),
        }),
      });
      setPlanForm({ name: '', slug: '', price: '', features: '' });
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subForm.tenantId || !subForm.planId) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(subForm),
      });
      setSubForm({ tenantId: '', planId: '' });
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubscription = async (id: string) => {
    if (!confirm(t('billing.confirmCancel'))) return;
    try {
      await apiClient(`/subscriptions/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (!isSuperAdmin) {
    return (
      <AdminLayout locale={locale}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          {t('billing.accessDenied')}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.billing')}</h1>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('billing.newPlan')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePlan} className="space-y-3">
                <Input
                  label={t('billing.planName')}
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  required
                />
                <Input
                  label={t('billing.planSlug')}
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                  placeholder="starter"
                  required
                />
                <Input
                  label={t('billing.planPrice')}
                  type="number"
                  min="0"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  required
                />
                <Input
                  label={t('billing.planFeatures')}
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                  placeholder={t('billing.planFeaturesPlaceholder')}
                />
                <Button type="submit" loading={submitting} className="w-full">
                  {t('billing.createPlan')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('billing.assignSubscription')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSubscription} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">{t('billing.tenant')}</label>
                  <select
                    value={subForm.tenantId}
                    onChange={(e) => setSubForm({ ...subForm, tenantId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  >
                    <option value="">{t('billing.selectTenant')}</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">{t('billing.plan')}</label>
                  <select
                    value={subForm.planId}
                    onChange={(e) => setSubForm({ ...subForm, planId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    required
                  >
                    <option value="">{t('billing.selectPlan')}</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {plan.price} {plan.currency}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" loading={submitting} className="w-full">
                  {t('billing.activateSubscription')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900">{t('billing.plans')}</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : plans.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('billing.noPlans')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">{t('billing.planName')}</th>
                    <th className="px-5 py-3 font-medium">{t('billing.planPrice')}</th>
                    <th className="px-5 py-3 font-medium">{t('billing.planFeatures')}</th>
                    <th className="px-5 py-3 font-medium">{t('admin.statusActive')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-800">{plan.name}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {plan.price} {plan.currency} / {plan.billingPeriod === 'YEARLY' ? t('billing.year') : t('billing.month')}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{plan.features.join(', ')}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            plan.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {plan.isActive ? t('admin.statusActive') : t('admin.statusInactive')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900">{t('billing.subscriptions')}</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : subscriptions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('billing.noSubscriptions')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">{t('billing.tenant')}</th>
                    <th className="px-5 py-3 font-medium">{t('billing.plan')}</th>
                    <th className="px-5 py-3 font-medium">{t('myBookings.status')}</th>
                    <th className="px-5 py-3 font-medium">{t('billing.periodEnd')}</th>
                    <th className="px-5 py-3 text-right font-medium">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-800">{sub.tenant.name}</td>
                      <td className="px-5 py-3 text-gray-600">{sub.plan.name}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_STYLES[sub.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {sub.status !== 'CANCELLED' && (
                          <Button variant="danger" size="sm" onClick={() => handleCancelSubscription(sub.id)}>
                            {t('common.cancel')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
