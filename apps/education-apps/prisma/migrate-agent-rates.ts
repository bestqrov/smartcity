import { PrismaClient } from '@prisma/client';
import { migrateAgentRates } from '../src/modules/sales-agents/salesAgents.migration';

const prisma = new PrismaClient();

migrateAgentRates(prisma)
    .then((count) => console.log(`Sales agents migrated to per-period rates: ${count}`))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
