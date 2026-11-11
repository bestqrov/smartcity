import type { PrismaClient } from '@prisma/client';

// The company's own code, used in its ads. It earns nothing and has no login.
export const HOUSE_AGENT = { name: 'Société (ARWA)', code: 'ARWA', commissionRate: 0, isHouse: true, active: true };

// Idempotent: never touches an existing house agent (a SUPER_ADMIN may have renamed it).
export const seedHouseAgent = async (client: PrismaClient) => {
    const existing = await client.salesAgent.findFirst({ where: { isHouse: true } });
    if (existing) return existing;
    return client.salesAgent.create({ data: HOUSE_AGENT });
};
