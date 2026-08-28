
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        const transactions = await prisma.transaction.findMany();
        console.log(`Found ${transactions.length} transactions:`);
        transactions.forEach(t => {
            console.log(JSON.stringify(t, null, 2));
        });

        // Check date range for this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        console.log('--- Date Range ---');
        console.log('Start:', startOfMonth);
        console.log('End:', endOfMonth);

        const monthlyTransactions = transactions.filter(t => {
            const d = new Date(t.date);
            return d >= startOfMonth && d <= endOfMonth;
        });

        console.log(`Transactions in valid range: ${monthlyTransactions.length}`);
        monthlyTransactions.forEach(t => {
            console.log(`- [${t.type}] ${t.amount} (${t.date})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
