'use client';

import { useState, FormEvent } from 'react';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { Button, Input, Badge, Modal, Skeleton } from '@smartcity/ui';
import { TransactionType } from '@smartcity/types';
import { useStudents } from '@/lib/students';
import {
  usePayments,
  useCreatePayment,
  useTransactions,
  useCreateTransaction,
  useFinanceStats,
} from '@/lib/finance';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/StatCard';

const TRANSACTION_TYPE_VARIANT: Record<string, 'success' | 'error'> = {
  INCOME: 'success',
  EXPENSE: 'error',
};

const TRANSACTION_TYPE_LABEL_KEY: Record<string, string> = {
  INCOME: 'education.typeIncome',
  EXPENSE: 'education.typeExpense',
};

export default function FinancePage() {
  const { t } = useTranslation();
  const { data: stats } = useFinanceStats();
  const { data: paymentsData, isLoading: isLoadingPayments } = usePayments();
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions();
  const { data: studentsData } = useStudents(1, 100);

  const createPayment = useCreatePayment();
  const createTransaction = useCreateTransaction();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionCategory, setTransactionCategory] = useState('');
  const [transactionDescription, setTransactionDescription] = useState('');
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const resetPaymentForm = () => {
    setPaymentStudentId('');
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentNotes('');
    setPaymentError(null);
  };

  const handleCreatePayment = async (event: FormEvent) => {
    event.preventDefault();
    setPaymentError(null);

    try {
      await createPayment.mutateAsync({
        studentId: paymentStudentId,
        amount: Number(paymentAmount),
        method: paymentMethod,
        notes: paymentNotes || undefined,
      });
      resetPaymentForm();
      setIsPaymentModalOpen(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const resetTransactionForm = () => {
    setTransactionType(TransactionType.EXPENSE);
    setTransactionAmount('');
    setTransactionCategory('');
    setTransactionDescription('');
    setTransactionError(null);
  };

  const handleCreateTransaction = async (event: FormEvent) => {
    event.preventDefault();
    setTransactionError(null);

    try {
      await createTransaction.mutateAsync({
        type: transactionType,
        amount: Number(transactionAmount),
        category: transactionCategory,
        description: transactionDescription || undefined,
      });
      resetTransactionForm();
      setIsTransactionModalOpen(false);
    } catch (err) {
      setTransactionError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const payments = paymentsData?.data ?? [];
  const transactions = transactionsData?.data ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('education.finance')}</h1>
      </div>

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={TrendingUp}
            color="green"
            label={t('education.totalIncome')}
            value={stats.totalIncome}
          />
          <StatCard
            icon={TrendingDown}
            color="rose"
            label={t('education.totalExpenses')}
            value={stats.totalExpense}
          />
          <StatCard
            icon={Scale}
            color="primary"
            label={t('education.balance')}
            value={stats.balance}
          />
        </div>
      )}

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('education.payments')}</h2>
          <Button onClick={() => setIsPaymentModalOpen(true)}>{t('education.addPayment')}</Button>
        </div>

        {isLoadingPayments && <Skeleton height="4rem" />}

        {!isLoadingPayments && payments.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noPaymentsYet')}</p>
        )}

        {!isLoadingPayments && payments.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.paymentStudent')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.paymentAmount')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.paymentMethod')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.selectDate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3 text-gray-900">
                      {payment.student.firstName} {payment.student.lastName}
                    </td>
                    <td className="p-3 text-gray-600">{payment.amount}</td>
                    <td className="p-3 text-gray-600">{payment.method}</td>
                    <td className="p-3 text-gray-600">
                      {new Date(payment.date).toLocaleDateString()}
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
          <h2 className="text-lg font-semibold text-gray-900">{t('education.transactions')}</h2>
          <Button onClick={() => setIsTransactionModalOpen(true)}>
            {t('education.addTransaction')}
          </Button>
        </div>

        {isLoadingTransactions && <Skeleton height="4rem" />}

        {!isLoadingTransactions && transactions.length === 0 && (
          <p className="text-sm text-gray-500">{t('education.noTransactionsYet')}</p>
        )}

        {!isLoadingTransactions && transactions.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.transactionType')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.transactionCategory')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.transactionAmount')}
                  </th>
                  <th className="p-3 text-start font-medium text-gray-500">
                    {t('education.selectDate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-3">
                      <Badge variant={TRANSACTION_TYPE_VARIANT[transaction.type] ?? 'default'}>
                        {t(TRANSACTION_TYPE_LABEL_KEY[transaction.type] ?? transaction.type)}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-600">{transaction.category}</td>
                    <td className="p-3 text-gray-600">{transaction.amount}</td>
                    <td className="p-3 text-gray-600">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={t('education.addPayment')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreatePayment} loading={createPayment.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePayment} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.paymentStudent')}
            </label>
            <select
              value={paymentStudentId}
              onChange={(e) => setPaymentStudentId(e.target.value)}
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
          <Input
            label={t('education.paymentAmount')}
            type="number"
            min="0.01"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
          />
          <Input
            label={t('education.paymentMethod')}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            required
          />
          <Input
            label={t('education.paymentNotes')}
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
          />
          {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
        </form>
      </Modal>

      <Modal
        open={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        title={t('education.addTransaction')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTransactionModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateTransaction} loading={createTransaction.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTransaction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('education.transactionType')}
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as TransactionType)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={TransactionType.EXPENSE}>{t('education.typeExpense')}</option>
              <option value={TransactionType.INCOME}>{t('education.typeIncome')}</option>
            </select>
          </div>
          <Input
            label={t('education.transactionAmount')}
            type="number"
            min="0.01"
            step="0.01"
            value={transactionAmount}
            onChange={(e) => setTransactionAmount(e.target.value)}
            required
          />
          <Input
            label={t('education.transactionCategory')}
            value={transactionCategory}
            onChange={(e) => setTransactionCategory(e.target.value)}
            required
          />
          <Input
            label={t('education.transactionDescription')}
            value={transactionDescription}
            onChange={(e) => setTransactionDescription(e.target.value)}
          />
          {transactionError && <p className="text-sm text-red-600">{transactionError}</p>}
        </form>
      </Modal>
    </div>
  );
}
