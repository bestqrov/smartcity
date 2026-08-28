const axios = require('axios');

async function testDocumentsEndpoint() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:3000/auth/login', {
            email: 'admin@injahi.com',
            password: 'admin123'
        });
        const token = loginRes.data.data.token;
        console.log('Login successful.');

        console.log('\nTesting /documents/students...');
        try {
            const res = await axios.get('http://localhost:3000/documents/students', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Documents Students: OK');
            console.log('Count:', res.data.data.length);
            // Verify structure
            if (res.data.data.length > 0) {
                const s = res.data.data[0];
                console.log('Sample Student:', s.name, s.surname);
                console.log('Has inscriptions:', !!s.inscriptions);
                console.log('Has payments:', !!s.payments);
            } else {
                console.log('No students found (but endpoint works)');
            }

        } catch (e) {
            console.error('❌ Documents Students Failed:', e.response?.status, e.response?.data || e.message);
        }

    } catch (error) {
        console.error('Login Failed!', error.response?.data || error.message);
    }
}

testDocumentsEndpoint();
