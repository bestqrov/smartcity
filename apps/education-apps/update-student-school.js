
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Update hassani hassan (Soutien) to have a school name
    await prisma.student.updateMany({
        where: { name: 'hassani', surname: 'hassan' },
        data: { currentSchool: 'Lycée Al Wahda' }
    });
    console.log('Updated hassani hassan');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
