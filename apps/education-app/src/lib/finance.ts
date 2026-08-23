import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IPayment, IStudent, ITransaction, TransactionType } from '@smartcity/types';
import { apiClient } from './api';

export interface PaymentWithStudent extends IPayment {
  student: IStudent;
}

interface PaymentListResponse {
  data: PaymentWithStudent[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface TransactionListResponse {
  data: ITransaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreatePaymentInput {
  studentId: string;
  amount: number;
  method: string;
  notes?: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
}

export interface FinanceStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export function usePayments(page = 1, limit = 20, studentId?: string) {
  return useQuery({
    queryKey: ['finance', 'payments', page, limit, studentId],
    queryFn: () =>
      apiClient<PaymentListResponse>(
        `/finance/payments?page=${page}&limit=${limit}${studentId ? `&studentId=${studentId}` : ''}`,
      ),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentInput) =>
      apiClient<PaymentWithStudent>('/finance/payments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] });
    },
  });
}

export function useTransactions(page = 1, limit = 20, type?: TransactionType) {
  return useQuery({
    queryKey: ['finance', 'transactions', page, limit, type],
    queryFn: () =>
      apiClient<TransactionListResponse>(
        `/finance/transactions?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`,
      ),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      apiClient<ITransaction>('/finance/transactions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] });
    },
  });
}

export function useFinanceStats() {
  return useQuery({
    queryKey: ['finance', 'stats'],
    queryFn: () => apiClient<FinanceStats>('/finance/stats'),
  });
}
