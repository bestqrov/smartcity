/**
 * Absolute URL of a public page (parent / student portal) to put in a QR code or a WhatsApp
 * message. A relative "/p/…" is useless once it leaves the browser, so fall back to the
 * current origin when NEXT_PUBLIC_FRONTEND_URL isn't configured.
 */
export const publicUrl = (path: string): string => {
    const configured = (process.env.NEXT_PUBLIC_FRONTEND_URL || '').replace(/\/+$/, '');
    const origin = configured || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Moroccan numbers as typed by staff ("06 12 34 56 78", "+212 6…") → wa.me digits ("2126…"). */
export const whatsappNumber = (phone: string | null | undefined): string | null => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
    return digits;
};

// Pages can't export helpers in the app router, so the share text lives here.
/** WhatsApp text sent with a parent's portal link (French + Darija). */
export const parentPortalMessage = (parentName: string) =>
    `Bonjour ${parentName}, voici votre accès pour suivre la présence, les paiements et les annonces de vos enfants :\n` +
    `السلام عليكم، هذا هو الرابط ديالكم باش تتبعو الحضور والأداءات والإعلانات ديال وليداتكم:`;

/** WhatsApp text sent with a teacher's grade-entry link (French + Darija). */
export const teacherPortalMessage = (teacherName: string) =>
    `Bonjour ${teacherName}, voici votre lien pour saisir les notes de vos groupes :\n` +
    `السلام عليكم، هذا هو الرابط ديالكم باش تدخلو النقط ديال الأقسام ديالكم:`;
