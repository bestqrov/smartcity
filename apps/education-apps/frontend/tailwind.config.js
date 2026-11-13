/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                vibrant: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
            },
            colors: {
                // "Vibrant" theme of the staff spaces (admin, owner, secretary).
                vib: {
                    bg: '#F5F5FA',
                    ink: '#111827',
                    night: '#0B0D14',
                    panel: '#12141C',
                    card: '#161925',
                    indigo: '#4F46E5',
                    emerald: '#047857',
                    amber: '#B45309',
                    pink: '#BE185D',
                    violet: '#6D28D9',
                    cyan: '#0E7490',
                },
                // Warm espresso palette of the sales agent space.
                espresso: {
                    50: '#F3EFEC',
                    100: '#E8DFD9',
                    200: '#D6C6BC',
                    300: '#C2A894',
                    400: '#B08D74',
                    500: '#957062',
                    600: '#7A5A52',
                    700: '#5C413B',
                    800: '#3B2622',
                    900: '#2A1E1B',
                    950: '#1E1513',
                    ink: '#150E0D',
                },
                steel: { DEFAULT: '#6E7F80', light: '#93A6A7' },
                charcoal: '#3A3A3A',
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
            },
        },
    },
    plugins: [],
}
