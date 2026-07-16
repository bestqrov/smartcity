'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">
          {t('home.title')}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          {t('home.subtitle')}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href={`/${locale}/hotels`}>
            <Button size="lg">{t('home.exploreHotels')}</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: t('home.featureHotels'), desc: t('tourism.hotels'), href: 'hotels' },
          { title: t('home.featureRestaurants'), desc: t('tourism.restaurants'), href: '#' },
          { title: t('home.featureActivities'), desc: t('tourism.activities'), href: '#' },
        ].map((item) => (
          <Card key={item.title} className="text-center">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{item.desc}</p>
              <Link href={`/${locale}/${item.href}`}>
                <Button variant="outline">{t('common.browseHotels')}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
