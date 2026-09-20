// Temporary default number; override with NEXT_PUBLIC_WHATSAPP_NUMBER (any local or international format).
const DEFAULT_NUMBER = '0608183886';

export const whatsappUrl = (raw: string = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || DEFAULT_NUMBER): string => {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `212${digits.slice(1)}`;
    return `https://wa.me/${digits}`;
};
