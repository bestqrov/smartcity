import prisma from '../../config/database';
import {
    DEFAULT_PARTNER_OFFER,
    seedPartnerOffer,
    getPartnerOfferFor,
    resolvePartnerOffer,
    getAdminPartnerOffer,
    updatePartnerOffer,
    offerPriceFor,
} from './partnerOffer.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        partnerOffer: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
        salesAgent: { findFirst: jest.fn() },
    },
}));

const offer = { id: 'o1', key: 'default', active: true, monthlyPrice: 120, semiannualPrice: 1299, yearlyPrice: 2000 };
const agent = { id: 'a1', code: 'PARTNER1', active: true, isHouse: false };

beforeEach(() => {
    (prisma.partnerOffer.findUnique as jest.Mock).mockReset().mockResolvedValue(offer);
    (prisma.partnerOffer.create as jest.Mock).mockReset();
    (prisma.partnerOffer.upsert as jest.Mock).mockReset();
    (prisma.salesAgent.findFirst as jest.Mock).mockReset().mockResolvedValue(agent);
});

describe('getPartnerOfferFor', () => {
    it('is eligible for an active non-house agent and exposes only the prices', async () => {
        await expect(getPartnerOfferFor('partner1')).resolves.toEqual({
            eligible: true,
            offer: { monthlyPrice: 120, semiannualPrice: 1299, yearlyPrice: 2000 },
        });
        expect(prisma.salesAgent.findFirst).toHaveBeenCalledWith({ where: { code: 'PARTNER1', active: true } });
    });

    const prices = { monthlyPrice: 120, semiannualPrice: 1299, yearlyPrice: 2000 };

    it.each([undefined, '', '   ', 42])('exposes the prices but is not eligible without a usable code (%p)', async (code) => {
        await expect(getPartnerOfferFor(code)).resolves.toEqual({ eligible: false, offer: prices });
    });

    it('exposes the prices but is not eligible for an unknown or inactive agent', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(getPartnerOfferFor('NOPE')).resolves.toEqual({ eligible: false, offer: prices });
    });

    it('exposes the prices but is not eligible for the house code', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue({ ...agent, isHouse: true, code: 'ARWA' });
        await expect(getPartnerOfferFor('ARWA')).resolves.toEqual({ eligible: false, offer: prices });
    });

    it('has no offer and is never eligible when the offer is switched off or missing', async () => {
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue({ ...offer, active: false });
        await expect(getPartnerOfferFor('PARTNER1')).resolves.toEqual({ eligible: false });
        await expect(getPartnerOfferFor(undefined)).resolves.toEqual({ eligible: false });
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getPartnerOfferFor('PARTNER1')).resolves.toEqual({ eligible: false });
    });
});

describe('resolvePartnerOffer', () => {
    it('returns the stored offer when eligible, null otherwise', async () => {
        await expect(resolvePartnerOffer('PARTNER1')).resolves.toEqual(offer);
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(resolvePartnerOffer('PARTNER1')).resolves.toBeNull();
    });
});

describe('offerPriceFor', () => {
    it('picks the price of the period', () => {
        expect(offerPriceFor(offer, 'MONTHLY')).toBe(120);
        expect(offerPriceFor(offer, 'SEMIANNUAL')).toBe(1299);
        expect(offerPriceFor(offer, 'YEARLY')).toBe(2000);
    });
});

describe('seedPartnerOffer', () => {
    it('creates the default offer when none exists', async () => {
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue(null);
        await seedPartnerOffer(prisma as any);
        expect(prisma.partnerOffer.create).toHaveBeenCalledWith({ data: DEFAULT_PARTNER_OFFER });
        expect(DEFAULT_PARTNER_OFFER).toEqual({ key: 'default', active: true, monthlyPrice: 120, semiannualPrice: 1299, yearlyPrice: 2000 });
    });

    it('leaves an existing offer untouched', async () => {
        await seedPartnerOffer(prisma as any);
        expect(prisma.partnerOffer.create).not.toHaveBeenCalled();
    });
});

describe('admin offer', () => {
    it('returns the stored offer, or the defaults when none is stored', async () => {
        await expect(getAdminPartnerOffer()).resolves.toEqual(offer);
        (prisma.partnerOffer.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getAdminPartnerOffer()).resolves.toEqual(DEFAULT_PARTNER_OFFER);
    });

    it('upserts valid input', async () => {
        (prisma.partnerOffer.upsert as jest.Mock).mockResolvedValue({ ...offer, monthlyPrice: 100 });
        await updatePartnerOffer({ active: false, monthlyPrice: 100, semiannualPrice: 500, yearlyPrice: 900 });
        expect(prisma.partnerOffer.upsert).toHaveBeenCalledWith({
            where: { key: 'default' },
            update: { active: false, monthlyPrice: 100, semiannualPrice: 500, yearlyPrice: 900 },
            create: { key: 'default', active: false, monthlyPrice: 100, semiannualPrice: 500, yearlyPrice: 900 },
        });
    });

    it.each([
        [{ active: true, monthlyPrice: 0, semiannualPrice: 1, yearlyPrice: 1 }, 'monthlyPrice must be a number greater than 0'],
        [{ active: true, monthlyPrice: 1, semiannualPrice: -5, yearlyPrice: 1 }, 'semiannualPrice must be a number greater than 0'],
        [{ active: true, monthlyPrice: 1, semiannualPrice: 1, yearlyPrice: '9' }, 'yearlyPrice must be a number greater than 0'],
        [{ active: true, monthlyPrice: 1, semiannualPrice: 1 }, 'yearlyPrice must be a number greater than 0'],
        [{ active: 'yes', monthlyPrice: 1, semiannualPrice: 1, yearlyPrice: 1 }, 'active must be a boolean'],
    ])('rejects invalid input %#', async (input, message) => {
        await expect(updatePartnerOffer(input as any)).rejects.toThrow(message);
        expect(prisma.partnerOffer.upsert).not.toHaveBeenCalled();
    });
});
