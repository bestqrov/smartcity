import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IInscription, IStudent } from '@smartcity/types';
import { apiClient } from './api';
import type { OfferingWithTeacher } from './offerings';

export interface InscriptionWithRelations extends IInscription {
  student: IStudent;
  offering: OfferingWithTeacher;
}

export interface CreatedInscription extends InscriptionWithRelations {
  tenantName: string;
  method: string;
}

interface InscriptionListResponse {
  data: InscriptionWithRelations[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateInscriptionInput {
  studentId: string;
  offeringId: string;
  amount: number;
  method: string;
  note?: string;
}

export function useInscriptions(page = 1, limit = 20, studentId?: string) {
  return useQuery({
    queryKey: ['inscriptions', page, limit, studentId],
    queryFn: () =>
      apiClient<InscriptionListResponse>(
        `/inscriptions?page=${page}&limit=${limit}${studentId ? `&studentId=${studentId}` : ''}`,
      ),
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInscriptionInput) =>
      apiClient<CreatedInscription>('/inscriptions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}
