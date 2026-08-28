
import { PrismaClient } from '@prisma/client';
import { createStudent, getStudentAnalytics } from '../src/modules/students/students.service';

const prisma = new PrismaClient();

async function main() {
    console.log('🧪 Testing Analytics Calculation...');

    // 1. Create a test student with subjects and fee
    console.log('1. Creating test student...');
    const studentData = {
        name: 'Test',
        surname: 'Student',
        inscriptionFee: 50,
        amountPaid: 150,
        subjects: {
            maths: true // Price 100
        }
    };

    const student = await createStudent(studentData);
    console.log('   Student created with ID:', student.id);

    // 2. Fetch Analytics
    console.log('2. Fetching Analytics...');

    // Debug helper
    const allInscriptions = await prisma.inscription.findMany();
    console.log('   DEBUG: Total Inscriptions in DB:', allInscriptions.length);
    allInscriptions.forEach(i => {
        console.log(`   - ID: ${i.id}, Type: ${i.type}, Amount: ${i.amount}, CreatedAt: ${i.createdAt}`);
    });

    const analytics = await getStudentAnalytics();
    console.log('   Analytics Start Date used internally (approx):', new Date().toISOString());

    console.log('3. Results:');
    console.log('   Total Students:', analytics.totalStudents);
    console.log('   Total Inscriptions:', analytics.totalInscriptions);
    console.log('   Total Revenue (Profit):', analytics.totalRevenue);

    // Expected Revenue: 50 (Fee) + 100 (Maths) = 150
    if (analytics.totalRevenue === 150) {
        console.log('✅ PASS: Revenue calculation is correct (150).');
    } else {
        console.log(`❌ FAIL: Revenue is ${analytics.totalRevenue}, expected 150.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
