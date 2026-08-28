const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSecretary() {
    try {
        // Get all users with SECRETARY role
        const secretaries = await prisma.user.findMany({
            where: { role: 'SECRETARY' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                gsm: true,
                whatsapp: true,
                address: true,
                schoolLevel: true,
                certification: true,
                createdAt: true,
            }
        });

        console.log(`Found ${secretaries.length} secretary account(s):`);
        console.log(JSON.stringify(secretaries, null, 2));
    } catch (error) {
        console.error('Error checking secretary:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSecretary();
