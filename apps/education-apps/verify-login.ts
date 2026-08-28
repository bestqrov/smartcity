import prisma from './src/config/database';
import bcrypt from 'bcryptjs';

async function verify() {
    const email = 'admin@injahi.com';
    const password = 'admin123';

    console.log(`Checking user: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.error('❌ User NOT FOUND in database!');
        return;
    }

    console.log('✅ User found:', user.id, user.role);
    console.log('Stored Hash:', user.password);

    const isValid = await bcrypt.compare(password, user.password);

    if (isValid) {
        console.log('✅ Password VALID');
    } else {
        console.error('❌ Password INVALID');
        // Test hashing again to see what it should be
        const newHash = await bcrypt.hash(password, 10);
        console.log('Expected Hash format example:', newHash);
    }
}

verify()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
