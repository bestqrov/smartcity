import { PrismaClient } from '@prisma/client';
import { seedHouseAgent } from '../src/modules/sales-agents/salesAgents.seed';

const prisma = new PrismaClient();

seedHouseAgent(prisma)
    .then((agent) => console.log('House agent:', { code: agent.code, isHouse: agent.isHouse }))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
