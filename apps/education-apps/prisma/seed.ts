import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting database seed...');

    // Create admin account
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@injahi.com' },
        update: {},
        create: {
            email: 'admin@injahi.com',
            password: hashedAdminPassword,
            name: 'Administrateur INJAHI',
            role: 'ADMIN',
        },
    });

    console.log('✅ Admin account created:', {
        email: admin.email,
        name: admin.name,
        role: admin.role,
    });

    // Create secretary account
    const hashedPassword = await bcrypt.hash('secretary123', 10);

    const secretary = await prisma.user.upsert({
        where: { email: 'secretary@injahi.com' },
        update: {
            name: 'Souad Injah',
        },
        create: {
            email: 'secretary@injahi.com',
            password: hashedPassword,
            name: 'Souad Injah',
            role: 'SECRETARY',
        },
    });

    console.log('✅ Secretary account created:', {
        email: secretary.email,
        name: secretary.name,
        role: secretary.role,
    });

    console.log('\n📋 Login Credentials:');
    console.log('\n🔐 ADMIN:');
    console.log('Email: admin@injahi.com');
    console.log('Password: admin123');
    console.log('\n🔐 SECRETARY:');
    console.log('Email: secretary@injahi.com');
    console.log('Password: secretary123');
    console.log('\n⚠️  Please change the passwords after first login!');

    // Create sample formations
    const formations = [
        {
            name: 'Développement Web Fullstack',
            duration: '6 mois',
            price: 3000,
            description: 'Formation complète en développement web (HTML, CSS, JS, React, Node.js)',
        },
        {
            name: 'Marketing Digital',
            duration: '3 mois',
            price: 1500,
            description: 'Maîtrisez les réseaux sociaux et la publicité en ligne',
        },
        {
            name: 'Design Graphique',
            duration: '4 mois',
            price: 2000,
            description: 'Apprenez Photoshop, Illustrator et InDesign',
        },
        {
            name: 'Comptabilité Pratique',
            duration: '3 mois',
            price: 1800,
            description: 'Formation pratique sur Sage et Excel',
        },
    ];

    console.log('\nCreating sample formations...');
    for (const formation of formations) {
        const existing = await prisma.formation.findFirst({
            where: { name: formation.name }
        });

        if (!existing) {
            await prisma.formation.create({
                data: formation
            });
            console.log(`Created formation: ${formation.name}`);
        } else {
            console.log(`Formation already exists: ${formation.name}`);
        }
    }

    // Create default pricing
    const pricingItems = [
        // LYCEE
        { category: 'SOUTIEN', level: 'Lycée', subject: 'Maths', price: 200 },
        { category: 'SOUTIEN', level: 'Lycée', subject: 'Physique et Chimique', price: 200 },
        { category: 'SOUTIEN', level: 'Lycée', subject: 'S.V.T', price: 200 },
        { category: 'SOUTIEN', level: 'Lycée', subject: 'Anglais', price: 150 },
        { category: 'SOUTIEN', level: 'Lycée', subject: 'Français', price: 150 },

        // COLLEGE
        { category: 'SOUTIEN', level: 'Collège', subject: 'Maths', price: 150 },
        { category: 'SOUTIEN', level: 'Collège', subject: 'Physique et Chimique', price: 150 },
        { category: 'SOUTIEN', level: 'Collège', subject: 'S.V.T', price: 150 },
        { category: 'SOUTIEN', level: 'Collège', subject: 'Anglais', price: 100 },

        // PRIMAIRE
        { category: 'SOUTIEN', level: 'Primaire', subject: 'Maths', price: 100 },
        { category: 'SOUTIEN', level: 'Primaire', subject: 'Français', price: 100 },
        { category: 'SOUTIEN', level: 'Primaire', subject: 'Français Communication', price: 100 },
        { category: 'SOUTIEN', level: 'Primaire', subject: 'Calcul Mental', price: 100 },
    ];

    console.log('\nCreating default pricing...');
    for (const item of pricingItems) {
        // Upsert based on composite key logic if possible, or just create if not exists
        // Since we don't have a unique constraint on (category, level, subject) easy to use here without ID,
        // we'll check first.
        const existing = await prisma.pricing.findFirst({
            where: {
                level: item.level,
                subject: item.subject,
                category: item.category
            }
        });

        if (!existing) {
            await prisma.pricing.create({
                data: {
                    ...item,
                    active: true
                }
            });
            console.log(`Created pricing: ${item.level} - ${item.subject}`);
        } else {
            console.log(`Pricing already exists: ${item.level} - ${item.subject}`);
        }
    }

    console.log('\n✅ Database seed completed!');
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
