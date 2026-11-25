import nodemailer, { type Transporter } from 'nodemailer';

/**
 * SMTP email for platform broadcasts. Settings come from the env, read lazily; the credentials are
 * never returned to a client or logged.
 */
const config = () => ({
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
});

export const isMailConfigured = (): boolean => {
    const c = config();
    return !!c.host && !!c.from;
};

let cached: { signature: string; transport: Transporter } | null = null;

const transport = () => {
    const c = config();
    const signature = `${c.host}|${c.port}|${c.user}|${c.pass}`;
    if (!cached || cached.signature !== signature) {
        cached = {
            signature,
            transport: nodemailer.createTransport({
                host: c.host,
                port: c.port,
                secure: c.port === 465,
                auth: c.user ? { user: c.user, pass: c.pass } : undefined,
            }),
        };
    }
    return cached.transport;
};

export const sendMail = async (to: string, subject: string, text: string): Promise<void> => {
    if (!isMailConfigured()) throw new Error('Email (SMTP) is not configured');
    await transport().sendMail({ from: config().from, to, subject, text });
};
