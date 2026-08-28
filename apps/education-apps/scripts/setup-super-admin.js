const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'Mrbrahim@arwaeduc.com'.toLowerCase();
    const password = 'arwa2025@@';

    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Checking for user with email: ${email}...`);

    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        console.log(`User found. Updating credentials and promoting to SUPER_ADMIN...`);
        await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                email,
                password: hashedPassword,
                role: 'SUPER_ADMIN'
            }
        });
        console.log(`User ${email} successfully updated and promoted to SUPER_ADMIN.`);
    } else {
        console.log(`User not found. Creating new SUPER_ADMIN account...`);
        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: 'Maintenance',
                role: 'SUPER_ADMIN'
            }
        });
        console.log(`SUPER_ADMIN account created successfully.`);
        console.log(`Email: ${email}`);
        console.log(`Temporary Password: ${password}`);
        console.log(`IMPORTANT: Please change this password after first login.`);
    }
}

main()
    .catch((e) => {
        console.error('Error running maintenance script:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
