import type { Metadata } from 'next';
import * as React from 'react';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { getDirection, supportedLocales } from '@smartcity/i18n';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SmartCity Education',
  description: 'Manage students, branches, and academic operations',
};

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const direction = getDirection(locale);

  return (
    <html lang={locale} dir={direction}>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
