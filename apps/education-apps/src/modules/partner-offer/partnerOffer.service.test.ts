import prisma from '../../config/database';
import {
    DEFAULT_PARTNER_OFFER,
    DEFAULT_DISCOUNTS,
    seedPartnerOffer,
    getPartnerOfferFor,
    resolvePartnerOffer,
    getAdminPartnerOffer,
    updatePartnerOffer,
    offerPriceFor,
    packBasePrice,
} from './partnerOffer.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        partnerOffer: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
        salesAgent: { findFirst: jest.fn() },
    },
}));

const discounts = { monthlyDiscount: 15, semiannualDiscount: 18, yearlyDiscount: 20 };
const offer = { id: 'o1', key: 'default', active: true, ...discounts };
const agent = { id: 'a1', code: 'PARTNER1', active: true, isHouse: false };

beforeEach(() => {
    (prisma.partnerOffer.findUnique as jest.Mock).mockReset().mockResolvedValue(offer);
    (prisma.partnerOffer.create as jest.Mock).mockReset();
    (prisma.partnerOffer.upsert as jest.Mock).mockReset();
    (prisma.salesAgent.findFirst as jest.Mock).mockReset().mockResolvedValue(agent);
});

describe('getPartnerOfferFor', () => {
    it('is eligible for an active non-house agent and exposes only the discounts', async () => {
        await expect(getPartnerOfferFor('partner1')).resolves.toEqual({ eligible: true, offer: discounts });
        expect(prisma.salesAgent.findFirst).toHaveBeenCalledWith({ where: { code: 'PARTNER1', active: true } });
    });

    it.each([undefined, '', '   ', 42])('exposes the discounts but is not eligible without a usable code (%p)', async (code) => {
        await expect(getPartnerOfferFor(code)).resolves.toEqual({ eligible: false, offer: discounts });
    });

    it('is not eligible for an unknown agent or the house code', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(getPartnerOfferFor('NOPE')).resolves.toEqual({ eligible: false, offer: discounts });
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue({ ...agent, isHouse: true, code: 'ARWA' });
        await expect(getPartnerOfferFor('ARWA')).resolves.toEqual({ eligible: false, offer: discounts });
    });

    it('fills a legacy flat-price document with the default discounts', async () => {
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue({ key: 'default', active: true, monthlyPrice: 250, semiannualPrice: 1299, yearlyPrice: 2000 });
        await expect(getPartnerOfferFor('PARTNER1')).resolves.toEqual({ eligible: true, offer: DEFAULT_DISCOUNTS });
    });

    it('has no offer and is never eligible when the offer is switched off or missing', async () => {
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue({ ...offer, active: false });
        await expect(getPartnerOfferFor('PARTNER1')).resolves.toEqual({ eligible: false });
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getPartnerOfferFor('PARTNER1')).resolves.toEqual({ eligible: false });
    });
});

describe('resolvePartnerOffer', () => {
    it('returns the discounts when eligible, null otherwise', async () => {
        await expect(resolvePartnerOffer('PARTNER1')).resolves.toEqual(discounts);
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(resolvePartnerOffer('PARTNER1')).resolves.toBeNull();
    });
});

describe('pricing', () => {
    const pack = { monthlyPrice: 299, yearlyPrice: 2990 };

    it('uses monthly, 6 × monthly and the yearly price as bases', () => {
        expect(packBasePrice(pack, 'MONTHLY')).toBe(299);
        expect(packBasePrice(pack, 'SEMIANNUAL')).toBe(1794);
        expect(packBasePrice(pack, 'YEARLY')).toBe(2990);
    });

    it('applies the period discount, rounded to the cent', () => {
        expect(offerPriceFor(pack, discounts, 'MONTHLY')).toBe(254.15);
        expect(offerPriceFor(pack, discounts, 'SEMIANNUAL')).toBe(1471.08);
        expect(offerPriceFor(pack, discounts, 'YEARLY')).toBe(2392);
    });
});

describe('seedPartnerOffer', () => {
    it('defaults to 15 / 18 / 20 %', () => {
        expect(DEFAULT_PARTNER_OFFER).toEqual({ key: 'default', active: true, monthlyDiscount: 15, semiannualDiscount: 18, yearlyDiscount: 20 });
    });

    it('creates the default offer when none exists, and leaves an existing one untouched', async () => {
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue(null);
        await seedPartnerOffer(prisma as any);
        expect(prisma.partnerOffer.create).toHaveBeenCalledWith({ data: DEFAULT_PARTNER_OFFER });

        (prisma.partnerOffer.create as jest.Mock).mockClear();
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue(offer);
        await seedPartnerOffer(prisma as any);
        expect(prisma.partnerOffer.create).not.toHaveBeenCalled();
    });
});

describe('admin offer', () => {
    it('returns the stored discounts, or the defaults when none is stored', async () => {
        await expect(getAdminPartnerOffer()).resolves.toEqual({ active: true, ...discounts });
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getAdminPartnerOffer()).resolves.toEqual({ active: true, ...DEFAULT_DISCOUNTS });
    });

    it('upserts valid input', async () => {
        const input = { active: false, monthlyDiscount: 10, semiannualDiscount: 12, yearlyDiscount: 25 };
        (prisma.partnerOffer.upsert as jest.Mock).mockResolvedValue({ key: 'default', ...input });
        await expect(updatePartnerOffer(input)).resolves.toEqual(input);
        expect(prisma.partnerOffer.upsert).toHaveBeenCalledWith({
            where: { key: 'default' },
            update: input,
            create: { key: 'default', ...input },
        });
    });

    it.each([
        [{ active: true, monthlyDiscount: -1, semiannualDiscount: 1, yearlyDiscount: 1 }, 'monthlyDiscount must be a whole number between 0 and 90'],
        [{ active: true, monthlyDiscount: 1, semiannualDiscount: 12.5, yearlyDiscount: 1 }, 'semiannualDiscount must be a whole number between 0 and 90'],
        [{ active: true, monthlyDiscount: 1, semiannualDiscount: 1, yearlyDiscount: 95 }, 'yearlyDiscount must be a whole number between 0 and 90'],
        [{ active: true, monthlyDiscount: 1, semiannualDiscount: 1 }, 'yearlyDiscount must be a whole number between 0 and 90'],
        [{ active: 'yes', monthlyDiscount: 1, semiannualDiscount: 1, yearlyDiscount: 1 }, 'active must be a boolean'],
    ])('rejects invalid input %#', async (input, message) => {
        await expect(updatePartnerOffer(input as any)).rejects.toThrow(message);
        expect(prisma.partnerOffer.upsert).not.toHaveBeenCalled();
    });
});
