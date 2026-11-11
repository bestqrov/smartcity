import { seedHouseAgent, HOUSE_AGENT } from './salesAgents.seed';

const makeClient = (existing: unknown) =>
    ({
        salesAgent: {
            findFirst: jest.fn().mockResolvedValue(existing),
            create: jest.fn().mockResolvedValue({ id: 'h1', ...HOUSE_AGENT }),
        },
    }) as any;

describe('seedHouseAgent', () => {
    it('creates the ARWA house agent when none exists', async () => {
        const client = makeClient(null);

        await seedHouseAgent(client);

        expect(client.salesAgent.findFirst).toHaveBeenCalledWith({ where: { isHouse: true } });
        expect(client.salesAgent.create).toHaveBeenCalledWith({
            data: {
                name: 'Société (ARWA)',
                code: 'ARWA',
                monthlyRate: 0,
                semiannualRate: 0,
                yearlyRate: 0,
                packRates: [],
                isHouse: true,
                active: true,
            },
        });
    });

    it('does nothing when a house agent already exists', async () => {
        const client = makeClient({ id: 'h0', isHouse: true });

        await expect(seedHouseAgent(client)).resolves.toEqual({ id: 'h0', isHouse: true });
        expect(client.salesAgent.create).not.toHaveBeenCalled();
    });
});
