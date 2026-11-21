import api from '../api';
import type { ApiResponse } from '@/types';

export type OfferPeriod = 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';

export const OFFER_PERIODS: OfferPeriod[] = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'];

// Whole-percent discounts on the chosen pack's price, one per period.
export interface PartnerOfferDiscounts {
    monthlyDiscount: number;
    semiannualDiscount: number;
    yearlyDiscount: number;
}

export interface PartnerOfferCheck {
    eligible: boolean;
    offer?: PartnerOfferDiscounts;
}

export interface AdminPartnerOffer extends PartnerOfferDiscounts {
    active: boolean;
}

export const isOfferPeriod = (value: unknown): value is OfferPeriod =>
    typeof value === 'string' && (OFFER_PERIODS as string[]).includes(value);

export const OFFER_MONTHS: Record<OfferPeriod, number> = { MONTHLY: 1, SEMIANNUAL: 6, YEARLY: 12 };

type PackPrices = { monthlyPrice: number; yearlyPrice: number };

export const offerDiscount = (offer: PartnerOfferDiscounts, period: OfferPeriod): number =>
    period === 'MONTHLY' ? offer.monthlyDiscount : period === 'SEMIANNUAL' ? offer.semiannualDiscount : offer.yearlyDiscount;

// Same rule as the API: 6 months = 6 × monthly, a year = the pack's yearly price.
export const packBasePrice = (pack: PackPrices, period: OfferPeriod): number =>
    period === 'MONTHLY' ? pack.monthlyPrice : period === 'SEMIANNUAL' ? pack.monthlyPrice * 6 : pack.yearlyPrice;

export const packOfferPrice = (pack: PackPrices, offer: PartnerOfferDiscounts, period: OfferPeriod): number =>
    Math.round(packBasePrice(pack, period) * (1 - offerDiscount(offer, period) / 100) * 100) / 100;

export const formatOfferMoney = (value: number): string =>
    value.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });

export async function fetchPartnerOffer(ref?: string): Promise<PartnerOfferCheck> {
    const response = await api.get<ApiResponse<PartnerOfferCheck>>('/partner-offer', { params: ref ? { ref } : {} });
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
