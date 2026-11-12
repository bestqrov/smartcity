import { ensureBaseData } from './ensureBaseData';
import { migrateAgentRates } from '../modules/sales-agents/salesAgents.migration';
import { seedHouseAgent } from '../modules/sales-agents/salesAgents.seed';
import { seedPartnerOffer } from '../modules/partner-offer/partnerOffer.service';

jest.mock('../modules/sales-agents/salesAgents.migration', () => ({ migrateAgentRates: jest.fn() }));
jest.mock('../modules/sales-agents/salesAgents.seed', () => ({ seedHouseAgent: jest.fn() }));
jest.mock('../modules/partner-offer/partnerOffer.service', () => ({ seedPartnerOffer: jest.fn() }));

const client = {} as any;

describe('ensureBaseData', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    it('migrates agent rates first, then seeds the house agent and the partner offer', async () => {
        const order: string[] = [];
        (migrateAgentRates as jest.Mock).mockImplementation(async () => { order.push('migrate'); return 0; });
        (seedHouseAgent as jest.Mock).mockImplementation(async () => { order.push('house'); return { code: 'ARWA' }; });
        (seedPartnerOffer as jest.Mock).mockImplementation(async () => { order.push('offer'); return { active: true }; });

        await expect(ensureBaseData(client)).resolves.toBe(true);
        expect(order).toEqual(['migrate', 'house', 'offer']);
        expect(migrateAgentRates).toHaveBeenCalledWith(client);
    });

    it('logs and returns false instead of crashing the server when a step fails', async () => {
        (migrateAgentRates as jest.Mock).mockRejectedValue(new Error('db down'));

        await expect(ensureBaseData(client)).resolves.toBe(false);
        expect(seedHouseAgent).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
    });
});
