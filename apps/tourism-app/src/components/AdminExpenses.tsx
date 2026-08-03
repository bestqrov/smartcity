'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface ExpenseCategory {
  id: string;
  name: string;
  isDefault: boolean;
}

interface Hotel {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  categoryId: string;
  hotelId: string | null;
  amount: number;
  currency: string;
  description: string | null;
  receiptUrl: string | null;
  date: string;
}

interface Summary {
  month: string;
  total: number;
  byCategory: Record<string, number>;
}

const CHART_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminExpenses({ locale }: { locale: string }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [summary, setSummary] = useState<Summary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState({ categoryId: '', hotelId: '', from: '', to: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: '',
    hotelId: '',
    amount: '',
    date: todayIso(),
    description: '',
    receiptUrl: '',
  });

  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const fetchCategories = () => apiClient('/expense-categories').then((res) => setCategories(res || []));

  const fetchHotels = () =>
    apiClient('/hotels?page=1&limit=100')
      .then((res) => setHotels(res.data || []))
      .catch(() => {});

  const fetchSummary = () =>
    apiClient(`/expenses/summary?month=${currentMonth()}`)
      .then((res) => setSummary(res))
      .catch(() => {});

  const fetchExpenses = (page = 1) => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.hotelId) params.set('hotelId', filters.hotelId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    return apiClient(`/expenses?${params.toString()}`).then((res) => {
      setExpenses(res.data || []);
      setMeta({
        total: res.meta?.total ?? 0,
        page: res.meta?.page ?? 1,
        totalPages: res.meta?.totalPages ?? 1,
      });
    });
  };

  const refreshAll = () => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchHotels(), fetchSummary(), fetchExpenses(1)])
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    fetchExpenses(1).catch((err) => setError(err instanceof Error ? err.message : t('common.error')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const resetForm = () => {
    setForm({
      categoryId: categories[0]?.id || '',
      hotelId: '',
      amount: '',
      date: todayIso(),
      description: '',
      receiptUrl: '',
    });
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setForm({
      categoryId: expense.categoryId,
      hotelId: expense.hotelId || '',
      amount: String(expense.amount),
      date: expense.date.slice(0, 10),
      description: expense.description || '',
      receiptUrl: expense.receiptUrl || '',
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      categoryId: form.categoryId,
      hotelId: form.hotelId || undefined,
      amount: parseFloat(form.amount),
      date: form.date,
      description: form.description || undefined,
      receiptUrl: form.receiptUrl || undefined,
    };

    try {
      if (editingId) {
        await apiClient(`/expenses/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiClient('/expenses', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      resetForm();
      fetchSummary();
      fetchExpenses(meta.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.confirmDeleteExpense'))) return;
    try {
      await apiClient(`/expenses/${id}`, { method: 'DELETE' });
      fetchSummary();
      fetchExpenses(meta.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await apiClient('/expense-categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setNewCategoryName('');
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t('admin.confirmDeleteCategory'))) return;
    try {
      await apiClient(`/expense-categories/${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const currency = expenses[0]?.currency || 'MAD';
  const topCategory = summary
    ? Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0]
    : undefined;
  const avgExpense = summary && meta.total > 0 ? summary.total / meta.total : 0;
  const maxCategoryValue = summary ? Math.max(...Object.values(summary.byCategory), 1) : 1;

  const statCards = [
    { key: 'admin.totalThisMonth', value: summary ? `${summary.total.toLocaleString()} ${currency}` : undefined, color: 'bg-blue-600' },
    {
      key: 'admin.topCategory',
      value: topCategory ? categoryMap[topCategory[0]] || '—' : undefined,
      color: 'bg-emerald-600',
    },
    { key: 'admin.avgExpense', value: summary && meta.total > 0 ? `${avgExpense.toFixed(0)} ${currency}` : undefined, color: 'bg-amber-500' },
    { key: 'admin.totalExpenses', value: meta.total, color: 'bg-rose-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.manageExpenses')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('admin.welcome')}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowCategoryPanel((v) => !v)}>
              {t('admin.expenseCategories')}
            </Button>
          )}
          <Button onClick={openCreateForm}>{t('admin.addExpense')}</Button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.key} className={`rounded-xl ${card.color} p-5 text-white shadow-sm`}>
            <p className="text-2xl font-bold">{loading ? '—' : card.value ?? '—'}</p>
            <p className="mt-1 text-sm font-medium text-white/90">{t(card.key)}</p>
          </div>
        ))}
      </div>

      {showCategoryPanel && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.expenseCategories')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddCategory} className="flex flex-wrap items-end gap-3">
              <Input
                label={t('admin.categoryName')}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" size="md">{t('admin.addCategory')}</Button>
            </form>
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500">{t('admin.noCategories')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-3 pr-1.5 text-sm font-medium text-gray-700"
                  >
                    {cat.name}
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
                      aria-label={t('common.delete')}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t('admin.editExpense') : t('admin.createExpense')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.category')}</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" disabled>—</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.hotels')} <span className="text-gray-400">({t('admin.optional')})</span>
                  </label>
                  <select
                    value={form.hotelId}
                    onChange={(e) => setForm({ ...form, hotelId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('admin.tenantWide')}</option>
                    {hotels.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label={t('admin.amount')}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
                <Input
                  label={t('admin.date')}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Input
                label={`${t('admin.receiptUrl')} (${t('admin.optional')})`}
                value={form.receiptUrl}
                onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
                placeholder="https://..."
              />

              <div className="flex gap-3">
                <Button type="submit" loading={submitting}>
                  {editingId ? t('admin.updateExpense') : t('admin.createExpense')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="border-b border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900">{t('admin.expensesByCategory')}</h2>
        </div>
        <div className="space-y-4 p-5">
          {loading ? (
            <div className="py-4 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : !summary || Object.keys(summary.byCategory).length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">{t('admin.noExpenses')}</div>
          ) : (
            Object.entries(summary.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([categoryId, value], i) => (
                <div key={categoryId} className="flex items-center gap-4">
                  <span className="w-32 shrink-0 truncate text-xs font-medium text-gray-600">
                    {categoryMap[categoryId] || categoryId}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${CHART_COLORS[i % CHART_COLORS.length]}`}
                      style={{ width: `${Math.max((value / maxCategoryValue) * 100, 4)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm font-semibold text-gray-800">
                    {value.toLocaleString()} {currency}
                  </span>
                </div>
              ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.category')}</label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">{t('admin.allCategories')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.hotels')}</label>
              <select
                value={filters.hotelId}
                onChange={(e) => setFilters({ ...filters, hotelId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">{t('admin.allHotels')}</option>
                {hotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
                ))}
              </select>
            </div>
            <Input
              label={t('admin.from')}
              type="date"
              size="sm"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <Input
              label={t('admin.to')}
              type="date"
              size="sm"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
            <div className="flex items-end">
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => setFilters({ categoryId: '', hotelId: '', from: '', to: '' })}
              >
                {t('admin.clearFilters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.expenses')} ({meta.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : expenses.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('admin.noExpenses')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="py-2 px-3 font-medium">{t('admin.date')}</th>
                    <th className="py-2 px-3 font-medium">{t('admin.category')}</th>
                    <th className="py-2 px-3 font-medium">{t('admin.description')}</th>
                    <th className="py-2 px-3 font-medium">{t('admin.amount')}</th>
                    <th className="py-2 px-3 font-medium text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 px-3 text-gray-600">
                        {new Date(expense.date).toLocaleDateString(locale)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          {categoryMap[expense.categoryId] || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {expense.description || '—'}
                        {expense.receiptUrl && (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-xs font-medium text-primary-600 hover:underline"
                          >
                            {t('admin.viewReceipt')}
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        {expense.amount.toLocaleString()} {expense.currency}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditForm(expense)}>
                            {t('common.edit')}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(expense.id)}>
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <span>{meta.page} / {meta.totalPages}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page <= 1}
                      onClick={() => fetchExpenses(meta.page - 1)}
                    >
                      {t('common.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => fetchExpenses(meta.page + 1)}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
