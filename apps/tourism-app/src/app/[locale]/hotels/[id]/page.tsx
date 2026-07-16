'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function HotelDetailPage() {
  const { locale, id } = useParams() as { locale: string; id: string };
  const { t } = useTranslation();
  const [hotel, setHotel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient(`/hotels/${id}`)
      .then((data) => setHotel(data))
      .catch(() => notFound())
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{hotel.name}</h1>
          <Badge>{hotel.type}</Badge>
        </div>
        <p className="text-gray-600">{hotel.address}, {hotel.city}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card >
            <CardHeader>
              <CardTitle>{t('hotels.description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{hotel.description || t('hotels.noDescription')}</p>
            </CardContent>
          </Card>

          <Card >
            <CardHeader>
              <CardTitle>{t('hotels.amenities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {hotel.amenities?.length > 0 ? (
                  hotel.amenities.map((amenity: string) => (
                    <Badge key={amenity} variant="default">{amenity}</Badge>
                  ))
                ) : (
                  <span className="text-gray-500">{t('hotels.noAmenities')}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card >
            <CardHeader>
              <CardTitle>{t('hotels.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('hotels.rating')}</span>
                <span className="font-medium">{hotel.rating > 0 ? `⭐ ${hotel.rating} (${hotel.reviewCount})` : t('hotels.rating')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('hotels.priceRange')}</span>
                <span className="font-medium">{hotel.priceRange || t('hotels.priceRange')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('hotels.phone')}</span>
                <span className="font-medium">{hotel.contactPhone || 'N/A'}</span>
              </div>
              <Link href={`/${locale}/hotels/${id}/book`}>
                <Button className="w-full">{t('hotels.bookNow')}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
