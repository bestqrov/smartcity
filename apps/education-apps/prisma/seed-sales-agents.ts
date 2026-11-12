import { PrismaClient } from '@prisma/client';
import { migrateAgentRates } from '../src/modules/sales-agents/salesAgents.migration';
import { seedPartnerOffer } from '../src/modules/partner-offer/partnerOffer.service';
import { seedHouseAgent } from '../src/modules/sales-agents/salesAgents.seed';

const prisma = new PrismaClient();

const main = async () => {
    // v1 agents must be converted before Prisma reads any agent.
    const migrated = await migrateAgentRates(prisma);
    console.log(`Sales agents migrated to per-period rates: ${migrated}`);
    const agent = await seedHouseAgent(prisma);
    console.log('House agent:', { code: agent.code, isHouse: agent.isHouse });
    const offer = await seedPartnerOffer(prisma);
    console.log('Partner offer:', { active: offer.active });
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
