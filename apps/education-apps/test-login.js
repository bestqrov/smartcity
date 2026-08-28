
const axios = require('axios');

async function testLogin() {
    try {
        console.log('Attempting login...');
        const response = await axios.post('http://localhost:3000/auth/login', {
            email: 'admin@school.com',
            password: 'admin123'
        });
        console.log('✅ Login Successful!');
        console.log('Token:', response.data.data.token ? 'Received' : 'Missing');
        console.log('User:', response.data.data.user);
    } catch (error) {
        console.error('❌ Login Failed:', error.response ? error.response.data : error.message);
    }
}

// Wait for server to start then run test
setTimeout(testLogin, 5000);
