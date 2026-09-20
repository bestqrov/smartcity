import { PrismaClient } from '@prisma/client';
import { seedPacks } from '../src/modules/packs/packs.seed';

const prisma = new PrismaClient();

seedPacks(prisma)
    .then(async () => {
        const packs = await prisma.pack.findMany({ orderBy: { sortOrder: 'asc' }, select: { code: true, isDefault: true, active: true } });
        console.log('Packs in database:', packs);
    })
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
