import ParentDetailClient from './ParentDetailClient';

// This app is built with `output: 'export'` (next.config.js), which requires every
// dynamic route to enumerate its params at build time. Parent IDs are only known at
// runtime (fetched from the API), so we return an empty list here and let the client
// component resolve `id` from the URL via `useParams()` after hydration.
export async function generateStaticParams() {
    return [];
}

export default function ParentDetailPage() {
    return <ParentDetailClient />;
}
