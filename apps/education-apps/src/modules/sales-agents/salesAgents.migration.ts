import type { Prisma, PrismaClient } from '@prisma/client';

const oldRate = { $ifNull: ['$commissionRate', 0] };

// v1 agents had one commissionRate; v2 has a rate per period plus pack exceptions. Prisma cannot read the
// old documents once the new rates are required, so this runs as a raw MongoDB pipeline update, before any
// read. Idempotent: only documents without monthlyRate are touched.
export const AGENT_RATES_MIGRATION: Prisma.InputJsonObject = {
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
};

// Returns the number of agents converted.
export const migrateAgentRates = async (client: Pick<PrismaClient, '$runCommandRaw'>): Promise<number> => {
    const result = (await client.$runCommandRaw(AGENT_RATES_MIGRATION)) as unknown as {
        nModified?: number;
        writeErrors?: unknown[];
    };
    if (result.writeErrors?.length) {
        throw new Error(`Agent rates migration failed: ${JSON.stringify(result.writeErrors)}`);
    }
    return Number(result.nModified ?? 0);
};
