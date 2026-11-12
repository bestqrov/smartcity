// Per-link manifest so the installed app opens on this parent's own space.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
    const base = `/p/${encodeURIComponent(params.token)}`;
    const manifest = {
        name: 'Espace parent',
        short_name: 'Espace parent',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#4f46e5',
        icons: [{ src: '/icon.jpg', sizes: '225x225', type: 'image/jpeg', purpose: 'any' }],
    };
    return new Response(JSON.stringify(manifest), {
        headers: {
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'no-store',
        },
    });
}
