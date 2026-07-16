import type { Metadata } from 'next';
import * as React from 'react';
import { Inter } from 'next/font/google';
import { ClientLayout } from '@/components/ClientLayout';
import { getDirection, supportedLocales } from '@smartcity/i18n';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SmartCity Tourism',
  description: 'Discover hotels, rooms, restaurants and activities',
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
        <ClientLayout locale={locale}>{children}</ClientLayout>
      </body>
    </html>
  );
}
