import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
    return {
        title: 'Espace parent',
        manifest: `/p/${encodeURIComponent(params.token)}/manifest.webmanifest`,
        appleWebApp: { capable: true, title: 'Espace parent', statusBarStyle: 'default' },
        robots: { index: false, follow: false },
    };
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#020617' },
    ],
};

export default function ParentSpaceLayout({ children }: { children: ReactNode }) {
    return children;
}
