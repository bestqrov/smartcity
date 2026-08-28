
import { PrismaClient } from '@prisma/client';
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting seed...');

    // Clean up existing users first to avoid duplicates
    try {
        await prisma.user.deleteMany();
        console.log('Cleared existing users.');
    } catch (e) {
        console.log('Error clearing users (might be empty):', e);
    }

    // 1. Create Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
        data: {
            email: 'admin@injahi.com',
            password: adminPassword,
            name: 'Admin User',
            role: 'ADMIN',
        },
    });
    console.log('Created Admin.');

    // 2. Create Secretary
    const secretaryPassword = await bcrypt.hash('secretary123', 10);
    const secretary = await prisma.user.create({
        data: {
            email: 'secretary@school.com',
            password: secretaryPassword,
            name: 'Secretary User',
            role: 'SECRETARY',
        },
    });
    console.log('Created Secretary.');

    console.log('--------------------------------');
    console.log('✅ USERS CREATED SUCCESSFULLY');
    console.log('--------------------------------');
    console.log('👤 ADMIN:');
    console.log('   Email:    admin@injahi.com');
    console.log('   Password: admin123');
    console.log('--------------------------------');
    console.log('👤 SECRETARY:');
    console.log('   Email:    secretary@school.com');
    console.log('   Password: secretary123');
    console.log('--------------------------------');
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
