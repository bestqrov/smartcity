import axios from 'axios';

async function main() {
    const studentData = {
        name: 'Test',
        surname: 'Student',
        schoolLevel: 'Lycée',
        inscriptionFee: 50,
        amountPaid: 350,
        subjects: { maths: true },
    };

    try {
        console.log('Creating student with inscription data...');
        const response = await axios.post('http://localhost:3000/students', studentData);
        console.log('Student created:', response.data.data.id);

        // Verify data
        console.log('Verifying data...');
        const verifyResponse = await axios.get(`http://localhost:3000/documents/students`);
        const student = verifyResponse.data.data.find((s: any) => s.id === response.data.data.id);

        if (student) {
            console.log('Student found in documents list.');
            console.log('Inscriptions:', student.inscriptions);
            console.log('Payments:', student.payments);

            if (student.inscriptions.length > 0 && student.payments.length > 0) {
                console.log('SUCCESS: Inscription and Payment records created.');
            } else {
                console.error('FAILURE: Missing inscription or payment records.');
            }
        } else {
            console.error('FAILURE: Student not found in documents list.');
        }

    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

main();
