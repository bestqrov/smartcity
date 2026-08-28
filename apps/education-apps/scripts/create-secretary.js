const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createSecretary() {
    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash('secretary123', 10);

        // Create secretary account
        const secretary = await prisma.user.create({
            data: {
                email: 'secretary@school.com',
                password: hashedPassword,
                name: 'Secretary',
                role: 'SECRETARY',
            },
        });

        console.log('Secretary account created successfully:');
        console.log(secretary);
    } catch (error) {
        console.error('Error creating secretary:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createSecretary();
