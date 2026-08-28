
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Checking Personnel Data ---');

        // Check Teachers
        const teachers = await prisma.teacher.findMany();
        console.log(`Teachers Found: ${teachers.length}`);
        teachers.forEach(t => console.log(`- [TEACHER] ${t.name}`));

        // Check Users (Admin/Secretary)
        const users = await prisma.user.findMany();
        console.log(`Users Found: ${users.length}`);
        users.forEach(u => console.log(`- [USER] ${u.name} (${u.role})`));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
