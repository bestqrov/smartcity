export interface LocaleConfig {
  locale: string;
  direction: 'ltr' | 'rtl';
  label: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { locale: 'ar', direction: 'rtl', label: 'العربية', flag: '🇲🇦' },
  { locale: 'fr', direction: 'ltr', label: 'Français', flag: '🇫🇷' },
  { locale: 'en', direction: 'ltr', label: 'English', flag: '🇬🇧' },
];

export const DEFAULT_LOCALE = 'fr';

export interface MoroccanCity {
  name: string;
  nameAr: string;
  nameFr: string;
  region: string;
}

export const MOROCCAN_CITIES: MoroccanCity[] = [
  { name: 'Marrakech', nameAr: 'مراكش', nameFr: 'Marrakech', region: 'Marrakech-Safi' },
  { name: 'Fes', nameAr: 'فاس', nameFr: 'Fès', region: 'Fès-Meknès' },
  { name: 'Casablanca', nameAr: 'الدار البيضاء', nameFr: 'Casablanca', region: 'Casablanca-Settat' },
  { name: 'Rabat', nameAr: 'الرباط', nameFr: 'Rabat', region: 'Rabat-Salé-Kénitra' },
  { name: 'Chefchaouen', nameAr: 'شفشاون', nameFr: 'Chefchaouen', region: 'Tanger-Tétouan-Al Hoceïma' },
  { name: 'Essaouira', nameAr: 'الصويرة', nameFr: 'Essaouira', region: 'Marrakech-Safi' },
  { name: 'Tangier', nameAr: 'طنجة', nameFr: 'Tanger', region: 'Tanger-Tétouan-Al Hoceïma' },
  { name: 'Agadir', nameAr: 'أكادير', nameFr: 'Agadir', region: 'Souss-Massa' },
  { name: 'Ouarzazate', nameAr: 'ورزازات', nameFr: 'Ouarzazate', region: 'Drâa-Tafilalet' },
  { name: 'Merzouga', nameAr: 'مرزوكة', nameFr: 'Merzouga', region: 'Drâa-Tafilalet' },
];

export const AMENITIES_LIST = [
  'wifi',
  'parking',
  'pool',
  'spa',
  'gym',
  'restaurant',
  'bar',
  'room_service',
  'laundry',
  'airport_shuttle',
  'concierge',
  'business_center',
  'pet_friendly',
  'air_conditioning',
  'heating',
  'minibar',
  'safe',
  'balcony',
  'sea_view',
  'mountain_view',
  'garden',
  'terrace',
  'hammam',
  'kids_club',
  'wheelchair_accessible',
] as const;

export type Amenity = (typeof AMENITIES_LIST)[number];

export const CURRENCY = 'MAD';

export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_VERIFY_EMAIL: '/auth/verify-email',

  // Users
  USERS: '/users',
  USER_BY_ID: '/users/:id',
  USER_PROFILE: '/users/me',

  // Tenants
  TENANTS: '/tenants',
  TENANT_BY_ID: '/tenants/:id',
  TENANT_BY_SLUG: '/tenants/slug/:slug',

  // Hotels
  HOTELS: '/hotels',
  HOTEL_BY_ID: '/hotels/:id',
  HOTEL_SEARCH: '/hotels/search',

  // Rooms
  ROOMS: '/rooms',
  ROOM_BY_ID: '/rooms/:id',
  ROOMS_BY_HOTEL: '/hotels/:hotelId/rooms',
  ROOM_AVAILABILITY: '/rooms/:id/availability',

  // Bookings
  BOOKINGS: '/bookings',
  BOOKING_BY_ID: '/bookings/:id',
  BOOKING_QR: '/bookings/:id/qr',
  BOOKING_CHECK_IN: '/bookings/:id/check-in',
  BOOKING_CHECK_OUT: '/bookings/:id/check-out',

  // Service Orders
  SERVICE_ORDERS: '/service-orders',
  SERVICE_ORDER_BY_ID: '/service-orders/:id',

  // Reviews
  REVIEWS: '/reviews',
  REVIEWS_BY_HOTEL: '/hotels/:hotelId/reviews',

  // Activities
  ACTIVITIES: '/activities',
  ACTIVITY_BY_ID: '/activities/:id',
  ACTIVITIES_BY_HOTEL: '/hotels/:hotelId/activities',

  // Restaurants
  RESTAURANTS: '/restaurants',
  RESTAURANT_BY_ID: '/restaurants/:id',
  RESTAURANTS_BY_HOTEL: '/hotels/:hotelId/restaurants',

  // Dashboard / Analytics
  DASHBOARD_OVERVIEW: '/dashboard/overview',
  DASHBOARD_REVENUE: '/dashboard/revenue',
  DASHBOARD_OCCUPANCY: '/dashboard/occupancy',
  DASHBOARD_ANALYTICS: '/dashboard/analytics',

  // Upload
  UPLOAD: '/upload',
  UPLOAD_IMAGE: '/upload/image',
} as const;
