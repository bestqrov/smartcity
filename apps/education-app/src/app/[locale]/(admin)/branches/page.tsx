'use client';

import { useState, FormEvent } from 'react';
import { Building2, MapPin } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { useBranches, useCreateBranch } from '@/lib/branches';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';
import { InitialsAvatar } from '@/components/InitialsAvatar';

export default function BranchesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createBranch.mutateAsync({ name, address, city });
      setName('');
      setAddress('');
      setCity('');
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const branches = data?.data ?? [];
  const citiesCount = new Set(branches.map((b) => b.city)).size;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.branches')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.addBranch')}</Button>
      </div>

      {!isLoading && branches.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={Building2}
            color="sky"
            label={t('education.totalBranches')}
            value={branches.length}
          />
          <StatCard
            icon={MapPin}
            color="sky"
            label={t('education.citiesCovered')}
            value={citiesCount}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && branches.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-500">
            <Building2 size={24} />
          </div>
          <p className="text-sm text-gray-500">{t('education.noBranchesYet')}</p>
        </div>
      )}

      {!isLoading && branches.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-start font-medium text-gray-500">{t('education.branchName')}</th>
                <th className="p-3 text-start font-medium text-gray-500">{t('education.branchCity')}</th>
                <th className="p-3 text-start font-medium text-gray-500">{t('education.branchAddress')}</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-b border-gray-100 last:border-0 hover:bg-sky-50/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={branch.name} color="sky" />
                      <span className="font-medium text-gray-900">{branch.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{branch.city}</td>
                  <td className="p-3 text-gray-600">{branch.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('education.addBranch')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createBranch.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('education.branchName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label={t('education.branchAddress')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <Input
            label={t('education.branchCity')}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
