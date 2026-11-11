// Client-side avatar preparation: downscale to fit 400x400 and re-encode as JPEG before upload.
const MAX_SIDE = 400;
const QUALITY = 0.85;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export class AvatarImageError extends Error {
    constructor(public code: 'type' | 'read') {
        super(code);
    }
}

export async function resizeAvatar(file: File): Promise<string> {
    if (!ACCEPTED.includes(file.type)) throw new AvatarImageError('type');
    const objectUrl = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new AvatarImageError('read'));
            el.src = objectUrl;
        });
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new AvatarImageError('read');
        // JPEG has no alpha: paint a white background under transparent PNG/WEBP pixels.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', QUALITY);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
