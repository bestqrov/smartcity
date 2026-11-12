import api from '../api';
import type { ApiResponse } from '@/types';

export type OfferPeriod = 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';

export const OFFER_PERIODS: OfferPeriod[] = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'];

export interface PartnerOfferPrices {
    monthlyPrice: number;
    semiannualPrice: number;
    yearlyPrice: number;
}

export interface PartnerOfferCheck {
    eligible: boolean;
    offer?: PartnerOfferPrices;
}

export interface AdminPartnerOffer extends PartnerOfferPrices {
    active: boolean;
}

export const isOfferPeriod = (value: unknown): value is OfferPeriod =>
    typeof value === 'string' && (OFFER_PERIODS as string[]).includes(value);

const MONTHS: Record<OfferPeriod, number> = { MONTHLY: 1, SEMIANNUAL: 6, YEARLY: 12 };

export const offerPrice = (offer: PartnerOfferPrices, period: OfferPeriod): number =>
    period === 'MONTHLY' ? offer.monthlyPrice : period === 'SEMIANNUAL' ? offer.semiannualPrice : offer.yearlyPrice;

// Equivalent monthly cost, and the whole-percent saving against paying the monthly price every month
// (null when there is no saving). Both come from the prices the API returned.
export const offerPerMonth = (offer: PartnerOfferPrices, period: OfferPeriod): number =>
    offerPrice(offer, period) / MONTHS[period];

export const offerSavingPercent = (offer: PartnerOfferPrices, period: OfferPeriod): number | null => {
    if (period === 'MONTHLY') return null;
    const full = offer.monthlyPrice * MONTHS[period];
    const percent = Math.round((1 - offerPrice(offer, period) / full) * 100);
    return percent > 0 ? percent : null;
};

export const formatOfferMoney = (value: number): string =>
    value.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });

export async function fetchPartnerOffer(ref: string): Promise<PartnerOfferCheck> {
    const response = await api.get<ApiResponse<PartnerOfferCheck>>('/partner-offer', { params: { ref } });
    return response.data.data;
}

export async function getAdminPartnerOffer(): Promise<AdminPartnerOffer> {
    const response = await api.get<ApiResponse<AdminPartnerOffer>>('/partner-offer/admin');
    return response.data.data;
}

export async function updatePartnerOffer(data: AdminPartnerOffer): Promise<AdminPartnerOffer> {
    const response = await api.put<ApiResponse<AdminPartnerOffer>>('/partner-offer', data);
    return response.data.data;
}
