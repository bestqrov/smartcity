/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    optimizeFonts: false,
    output: 'export',
    distDir: 'dist',
    images: {
        unoptimized: true,
        domains: ['localhost'],
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:3000/:path*',
            },
        ];
    },
}

module.exports = nextConfig
