const axios = require('axios');

async function checkAndCreateUsers() {
    try {
        // First, try to login as admin to get a token
        console.log('Attempting to login as admin...');
        const loginResponse = await axios.post('http://localhost:3000/auth/login', {
            email: 'admin@injahi.com',
            password: 'admin123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful, token received');

        // Fetch all users
        console.log('\nFetching all users...');
        const usersResponse = await axios.get('http://localhost:3000/users', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const users = usersResponse.data.data;
        console.log(`\nFound ${users.length} users:`);
        users.forEach(user => {
            console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
        });

        const admin = users.find(u => u.role === 'ADMIN');
        const secretary = users.find(u => u.role === 'SECRETARY');

        console.log('\n--- Summary ---');
        console.log(`Admin user: ${admin ? '✅ Found' : '❌ Not found'}`);
        console.log(`Secretary user: ${secretary ? '✅ Found' : '❌ Not found'}`);

        if (admin) {
            console.log(`\nAdmin details:`);
            console.log(`  Name: ${admin.name}`);
            console.log(`  Email: ${admin.email}`);
            console.log(`  Has avatar: ${admin.avatar ? 'Yes' : 'No'}`);
        }

        if (secretary) {
            console.log(`\nSecretary details:`);
            console.log(`  Name: ${secretary.name}`);
            console.log(`  Email: ${secretary.email}`);
            console.log(`  Has avatar: ${secretary.avatar ? 'Yes' : 'No'}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

checkAndCreateUsers();
