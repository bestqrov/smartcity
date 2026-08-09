'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  hotels: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" />
    </svg>
  ),
  restaurants: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v7a2 2 0 01-2 2H5V3m3 12v6M5 3v6M12 3v18M17 3c-1.5 0-3 1.5-3 4s1.5 4 3 4v11" />
    </svg>
  ),
  activities: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 16.9l-6.2 3.4 1.6-6.8L2.2 8.9l6.9-.6L12 2z" />
    </svg>
  ),
  qr: (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m-3 3h6v-6h-3" />
    </svg>
  ),
};

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [featuredHotels, setFeaturedHotels] = React.useState<any[]>([]);

  React.useEffect(() => {
    apiClient('/hotels')
      .then((response) => setFeaturedHotels((response.data || []).slice(0, 3)))
      .catch(() => setFeaturedHotels([]));
  }, []);

  const features = [
    { key: 'hotels', title: t('home.featureHotels'), desc: t('tourism.hotels'), href: 'hotels' },
    { key: 'restaurants', title: t('home.featureRestaurants'), desc: t('tourism.restaurants'), href: '#' },
    { key: 'activities', title: t('home.featureActivities'), desc: t('tourism.activities'), href: '#' },
    { key: 'qr', title: t('home.featureQr'), desc: t('tourism.scanQR'), href: '#' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-cyan-500 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
            {t('home.title')}
          </h1>
          <p className="text-lg sm:text-xl text-primary-50/90 max-w-2xl mx-auto mb-10">
            {t('home.subtitle')}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = `/${locale}/hotels${query ? `?q=${encodeURIComponent(query)}` : ''}`;
            }}
            className="mx-auto flex max-w-xl flex-col sm:flex-row gap-3 rounded-2xl bg-white/95 p-2 shadow-xl backdrop-blur"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('hotels.searchPlaceholder')}
              className="w-full flex-1 rounded-xl bg-transparent px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <Button type="submit" size="lg" className="shrink-0">
              {t('common.search')}
            </Button>
          </form>

          <div className="mt-8 flex justify-center gap-4">
            <Link href={`/${locale}/hotels`}>
              <Button variant="secondary" size="lg">
                {t('home.exploreHotels')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: '500+', label: t('home.statHotels') },
            { value: '40+', label: t('home.statCities') },
            { value: '50k+', label: t('home.statGuests') },
            { value: '24/7', label: t('home.statSupport') },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl sm:text-4xl font-extrabold text-primary-700">{stat.value}</div>
              <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">{t('home.featuresTitle')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((item) => (
            <Card
              key={item.key}
              className="text-center hover:shadow-xl hover:-translate-y-1 border-gray-100"
            >
              <CardHeader className="items-center">
                <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  {FEATURE_ICONS[item.key]}
                </div>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{item.desc}</p>
                <Link href={`/${locale}/${item.href}`}>
                  <Button variant="outline" size="sm">
                    {t('common.browseHotels')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Featured hotels */}
      {featuredHotels.length > 0 && (
        <div className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">{t('home.featuredHotels')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredHotels.map((hotel: any) => (
                <Link key={hotel.id} href={`/${locale}/hotels/${hotel.id}`}>
                  <Card className="h-full hover:shadow-xl hover:-translate-y-1">
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
        </div>
      )}

      {/* Bottom CTA */}
      <section className="bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            {t('common.discoverHotels')}
          </h2>
          <Link href={`/${locale}/hotels`}>
            <Button variant="secondary" size="lg">
              {t('home.exploreHotels')}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
