import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

// Poppins is the font of the staff spaces (admin, owner, secretary): exposed as a CSS variable, used via `font-vibrant`.
const poppins = Poppins({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-poppins',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'ArwaEduc',
    description: 'Système de gestion scolaire',
};

// Applies the saved light/dark choice of the staff spaces before hydration, so the first paint doesn't flash.
// Scoped to /admin and /secretary (not the platform shell, which has its own theme).
const NO_FLASH_THEME = `(function(){try{var p=location.pathname;if((p.indexOf('/admin')===0&&p.indexOf('/admin/platform')!==0)||p.indexOf('/secretary')===0){if(localStorage.getItem('app-theme')!=='light')document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr" className={poppins.variable} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
            </head>
            <body className="font-sans">{children}</body>
        </html>
    );
}
