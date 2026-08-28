
import prisma from '../src/config/database';

async function debugPayments() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    console.log('--- DEBUG: Date Range ---');
    console.log('Start:', startOfMonth.toISOString());
    console.log('End:  ', endOfMonth.toISOString());

    // 1. Fetch Payments
    const payments = await prisma.payment.findMany({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        },
        include: {
            student: true
        }
    });

    console.log('\n--- DEBUG: Payments (This Month) ---');
    let totalPayments = 0;
    if (payments.length === 0) {
        console.log('No payments found.');
    } else {
        payments.forEach(p => {
            console.log(`[${p.date.toISOString()}] Amount: ${p.amount} | Student: ${p.student?.name} ${p.student?.surname} | Note: ${p.note}`);
            totalPayments += p.amount;
        });
    }
    console.log(`TOTAL PAYMENTS: ${totalPayments.toFixed(2)} MAD`);


    // 2. Fetch Inscriptions
    const inscriptions = await prisma.inscription.findMany({
        where: {
            createdAt: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        },
        include: {
            student: true
        }
    });

    console.log('\n--- DEBUG: Inscriptions (This Month) ---');
    let totalInscriptionsAmount = 0;
    let totalRevenueProjected = 0; // Inscription Fee + Subjects (if applicable)

    if (inscriptions.length === 0) {
        console.log('No inscriptions found.');
    } else {
        inscriptions.forEach(i => {
            console.log(`[${i.createdAt.toISOString()}] Amount: ${i.amount} | Type: ${i.type} | Student: ${i.student?.name}`);
            totalInscriptionsAmount += i.amount;

            // Simple projection: just sum amounts for now
        });
    }
    console.log(`TOTAL INSCRIPTION FEES: ${totalInscriptionsAmount.toFixed(2)} MAD`);

    console.log('\n--- ANALYSIS ---');
    console.log(`Difference (Payments - Inscriptions): ${(totalPayments - totalInscriptionsAmount).toFixed(2)} MAD`);
    if (totalPayments < totalInscriptionsAmount) {
        console.log('WARNING: Received less than Inscription Fees. Some students might not have paid.');
    } else if (totalPayments > totalInscriptionsAmount) {
        console.log('INFO: Received MORE than Inscription Fees. Likely includes Subject Fees or Formation Costs.');
    } else {
        console.log('INFO: Perfect match.');
    }
}

debugPayments()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
