import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export type OnboardingStepKey = 'profile' | 'prices' | 'formations' | 'groups' | 'teachers' | 'staff' | 'transport' | 'firstStudent';

export interface OnboardingStep {
    key: OnboardingStepKey;
    done: boolean;
    skipped: boolean;
    optional: boolean;
    href: string;
}

export interface OnboardingState {
    steps: OnboardingStep[];
    completed: boolean;
    dismissed: boolean;
}

export type OnboardingUpdate = { skip: OnboardingStepKey } | { unskip: OnboardingStepKey } | { dismissed: boolean };

export async function getOnboarding(): Promise<OnboardingState> {
    const response = await api.get<ApiResponse<OnboardingState>>('/onboarding');
    return response.data.data;
}

export async function updateOnboarding(body: OnboardingUpdate): Promise<OnboardingState> {
    const response = await api.patch<ApiResponse<OnboardingState>>('/onboarding', body);
    return response.data.data;
}

/** First step neither done nor skipped, or null when the checklist is complete. */
export const nextStep = (state: OnboardingState) => state.steps.find((s) => !s.done && !s.skipped) ?? null;
