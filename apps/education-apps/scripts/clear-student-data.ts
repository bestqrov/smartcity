
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🗑️  Clearing student data...');

    // Delete in order of dependency
    await prisma.attendance.deleteMany();
    console.log('✅ Attendances deleted');

    await prisma.payment.deleteMany();
    console.log('✅ Payments deleted');

    await prisma.inscription.deleteMany();
    console.log('✅ Inscriptions deleted');

    // Delete students last because others depend on it
    await prisma.student.deleteMany();
    console.log('✅ Students deleted');

    console.log('\n✨ Analytics reset to 0/0');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
