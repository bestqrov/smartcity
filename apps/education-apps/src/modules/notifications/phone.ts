/** Same normalisation as frontend/lib/publicUrl.ts whatsappNumber: 0XXXXXXXXX → 212XXXXXXXXX. */
export const whatsappNumber = (phone: string | null | undefined): string | null => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
    return digits;
};
