
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking pricing table...');
    const pricing = await prisma.pricing.findMany();
    console.log(`Found ${pricing.length} pricing items.`);
    if (pricing.length > 0) {
        console.log('Sample items:', JSON.stringify(pricing.slice(0, 3), null, 2));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
