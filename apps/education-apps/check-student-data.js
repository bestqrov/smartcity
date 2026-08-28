
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const students = await prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { inscriptions: true }
    });

    console.log('--- Students ---');
    students.forEach(s => {
        console.log(`Name: ${s.name} ${s.surname}`);
        console.log(`Current School: ${s.currentSchool}`);
        console.log(`Inscriptions: ${s.inscriptions.map(i => i.type + ':' + i.category).join(', ')}`);
        console.log('----------------');
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
