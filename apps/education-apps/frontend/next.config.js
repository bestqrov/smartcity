/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    optimizeFonts: false,
    images: {
        unoptimized: true,
        domains: ['localhost'],
    },
    async rewrites() {
        // In production (docker-compose), INTERNAL_API_URL points to the
        // education-service container over the internal Docker network
        // (e.g. http://education-service:3010). Locally it falls back to
        // the backend's default dev port. The backend mounts all routes
        // under /api, so that prefix is preserved end-to-end here.
        const internalApiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
        return [
            {
                source: '/api/:path*',
                destination: `${internalApiUrl}/api/:path*`,
            },
        ];
    },
}

module.exports = nextConfig
