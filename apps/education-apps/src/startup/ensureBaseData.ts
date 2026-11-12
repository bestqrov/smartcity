import type { PrismaClient } from '@prisma/client';
import { migrateAgentRates } from '../modules/sales-agents/salesAgents.migration';
import { seedHouseAgent } from '../modules/sales-agents/salesAgents.seed';
import { seedPartnerOffer } from '../modules/partner-offer/partnerOffer.service';

// Data every environment needs, created at startup so a deploy needs no manual seed step. Every step is
// idempotent (only adds what is missing, never overwrites what a super admin edited).
// Order matters: v1 agents must be migrated before Prisma reads any agent.
export const ensureBaseData = async (client: PrismaClient): Promise<boolean> => {
    try {
        const migrated = await migrateAgentRates(client);
        if (migrated > 0) console.log(`✅ Sales agents migrated to per-period rates: ${migrated}`);
        await seedHouseAgent(client);
        await seedPartnerOffer(client);
        console.log('✅ Base data ready (company code ARWA, partner offer)');
        return true;
    } catch (error) {
        // Don't take the whole API down: log loudly so the deploy logs show it.
        console.error('❌ Base data setup failed (sales agents / partner offer):', error);
        return false;
    }
};
