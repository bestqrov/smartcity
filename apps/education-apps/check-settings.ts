
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const settings = await prisma.settings.findFirst();
    console.log('Current Settings:', settings);

    if (settings && (settings.director === 'Abdelhadi Tarabi' || settings.contactInfo?.includes('Abdelhadi'))) {
        console.log('Found "Abdelhadi Tarabi", updating...');
        // Update logic here if field existed, but Settings model mostly has schoolName, contactInfo
        // Check if it's in contactInfo
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
