'use client';

import * as React from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function HotelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { t } = useTranslation();
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient('/hotels')
      .then((response) => setHotels(response.data || []))
      .catch(() => setHotels([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('hotels.title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels?.map((hotel: any) => (
          <Link key={hotel.id} href={`/${locale}/hotels/${hotel.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{hotel.name}</CardTitle>
                <Badge variant="default">{hotel.city}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm line-clamp-2">
                  {hotel.description || t('hotels.noDescription')}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {hotel.rating > 0 ? `⭐ ${hotel.rating}` : t('hotels.rating')}
                  </span>
                  <span className="text-sm text-gray-500">
                    {hotel.priceRange || t('hotels.priceRange')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
