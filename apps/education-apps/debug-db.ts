
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- ALL USERS ---');
    const users = await prisma.user.findMany();
    users.forEach(u => console.log(`${u.email}: ${u.name} (${u.role})`));

    console.log('\n--- SETTINGS ---');
    const settings = await prisma.settings.findFirst();
    console.log(settings);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
