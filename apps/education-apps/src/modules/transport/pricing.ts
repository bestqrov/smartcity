export type TransportPricingMode = 'ROUTE' | 'STOP' | 'UNIFORM';

interface Priced {
    monthlyPrice?: number | null;
}

export const resolveMonthlyPrice = (
    mode: TransportPricingMode | null | undefined,
    route: Priced,
    stop: Priced,
    uniformPrice?: number | null
): number => {
    const effectiveMode = mode ?? 'ROUTE';
    const price =
        effectiveMode === 'STOP' ? stop.monthlyPrice : effectiveMode === 'UNIFORM' ? uniformPrice : route.monthlyPrice;

    if (price == null || !(price > 0)) {
        throw new Error(`Transport price is not configured for pricing mode ${effectiveMode}`);
    }

    return price;
};
