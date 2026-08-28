import dotenv from 'dotenv';

dotenv.config();

export const env = {
    DATABASE_URL: process.env.DATABASE_URL || process.env.MONGODB_URI || '',
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://appinjahi.techmar.cloud',
    PROXY_TARGET: process.env.PROXY_TARGET || 'http://127.0.0.1:3001',
};

// Validate required environment variables
const skipDbCheck = process.env.SKIP_DB_CHECK === 'true';

if (!env.DATABASE_URL && !skipDbCheck) {
    console.error('\n❌ ERROR: DATABASE_URL (or MONGODB_URI) is missing!');
    console.error('Please set DATABASE_URL or MONGODB_URI in your environment variables.');
    console.error('Example: DATABASE_URL="mongodb+srv://user:password@cluster.mongodb.net/school_management"\n');
    throw new Error('DATABASE_URL or MONGODB_URI is required in environment variables. If you want to skip this check (e.g. during build), set SKIP_DB_CHECK=true');
}

if (!env.JWT_SECRET || env.JWT_SECRET === 'your-secret-key') {
    console.warn('⚠️  WARNING: Using default JWT_SECRET. Please set a secure secret in production!');
}
