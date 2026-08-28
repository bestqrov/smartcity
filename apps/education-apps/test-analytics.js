const axios = require('axios');

async function testAnalytics() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:3000/auth/login', {
            email: 'admin@injahi.com',
            password: 'admin123'
        });
        const token = loginRes.data.data.token;
        console.log('Login successful. Token acquired.');

        const config = { headers: { Authorization: `Bearer ${token}` } };

        console.log('\nTesting /students/analytics...');
        try {
            const r1 = await axios.get('http://localhost:3000/students/analytics', config);
            console.log('✅ Students Analytics: OK');
        } catch (e) {
            console.error('❌ Students Analytics Failed:', e.response?.status, e.response?.data || e.message);
        }

        console.log('\nTesting /payments/analytics...');
        try {
            const r2 = await axios.get('http://localhost:3000/payments/analytics', config);
            console.log('✅ Payments Analytics: OK');
        } catch (e) {
            console.error('❌ Payments Analytics Failed:', e.response?.status, e.response?.data || e.message);
        }

        console.log('\nTesting /formations/analytics...');
        try {
            const r3 = await axios.get('http://localhost:3000/formations/analytics', config);
            console.log('✅ Formations Analytics: OK');
        } catch (e) {
            console.error('❌ Formations Analytics Failed:', e.response?.status, e.response?.data || e.message);
        }

    } catch (error) {
        console.error('Login Failed!', error.response?.data || error.message);
    }
}

testAnalytics();
