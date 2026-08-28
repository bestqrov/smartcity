const axios = require('axios');

async function testLogin() {
    try {
        console.log('Attempting login...');
        const response = await axios.post('http://localhost:3000/auth/login', {
            email: 'admin@injahi.com',
            password: 'admin123'
        });
        console.log('Login successful!');
        console.log('Token received:', response.data.data.token ? 'Yes' : 'No');

        const token = response.data.data.token;

        console.log('Attempting verify /auth/me...');
        const meResponse = await axios.get('http://localhost:3000/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Verify successful!');
        console.log('User:', meResponse.data.data.email);

    } catch (error) {
        console.error('Test failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testLogin();
