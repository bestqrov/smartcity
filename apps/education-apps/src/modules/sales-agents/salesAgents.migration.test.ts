import { migrateAgentRates } from './salesAgents.migration';

const makeClient = (result: unknown) => ({ $runCommandRaw: jest.fn().mockResolvedValue(result) }) as any;

describe('migrateAgentRates', () => {
    it('sends one idempotent pipeline update on agents that have no per-period rates yet', async () => {
        const client = makeClient({ n: 3, nModified: 3, ok: 1 });

        await expect(migrateAgentRates(client)).resolves.toBe(3);

        const oldRate = { $ifNull: ['$commissionRate', 0] };
        expect(client.$runCommandRaw).toHaveBeenCalledTimes(1);
        expect(client.$runCommandRaw).toHaveBeenCalledWith({
            update: 'sales_agents',
            updates: [
                {
                    q: { monthlyRate: { $exists: false } },
                    u: [
                        { $set: { monthlyRate: oldRate, semiannualRate: oldRate, yearlyRate: oldRate, packRates: [] } },
                        { $unset: 'commissionRate' },
                    ],
                    multi: true,
                },
            ],
        });
    });

    it('reports 0 when every agent is already migrated', async () => {
        await expect(migrateAgentRates(makeClient({ n: 0, nModified: 0, ok: 1 }))).resolves.toBe(0);
    });

    it('fails loudly on write errors', async () => {
        const client = makeClient({ n: 1, nModified: 0, ok: 1, writeErrors: [{ index: 0, errmsg: 'boom' }] });
        await expect(migrateAgentRates(client)).rejects.toThrow('Agent rates migration failed');
    });
});
