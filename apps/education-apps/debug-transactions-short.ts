
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const transactions = await prisma.transaction.findMany();
        console.log(`Count: ${transactions.length}`);

        transactions.forEach(t => {
            console.log(`ID:${t.id} T:${t.type} AMT:${t.amount} DATE:${t.date}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
