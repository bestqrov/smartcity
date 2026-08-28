import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching latest student...');
    const student = await prisma.student.findFirst({
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            inscriptions: true,
            payments: true,
        },
    });

    if (!student) {
        console.log('No students found.');
        return;
    }

    console.log('Latest Student:', {
        id: student.id,
        name: student.name,
        surname: student.surname,
        createdAt: student.createdAt,
    });

    console.log('Inscriptions:', student.inscriptions);
    console.log('Payments:', student.payments);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
