'use client';

import { useState, FormEvent } from 'react';
import {
  Button,
  Input,
  Card,
  CardContent,
  Modal,
  Skeleton,
} from '@smartcity/ui';
import { useBranches, useCreateBranch } from '@/lib/branches';
import { useTranslation } from '@/lib/i18n';

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.branches')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('education.addBranch')}</Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton height="4rem" />
          <Skeleton height="4rem" />
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-gray-500">{t('education.noBranchesYet')}</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((branch) => (
            <Card key={branch.id}>
              <CardContent>
                <p className="font-medium text-gray-900">{branch.name}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {branch.address}, {branch.city}
                </p>
              </CardContent>
            </Card>
          ))}
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
