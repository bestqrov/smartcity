import { PrismaClient, UserRole, TenantType, RoomType, ActivityType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

async function main() {
  console.log('🌱 Seeding SmartCity database...');

  // ── Clean existing data ──────────────────────────────────
  await prisma.serviceOrder.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ── SuperAdmin ───────────────────────────────────────────
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@smartcity.ma',
      passwordHash: hashPassword('Admin123!'),
      firstName: 'Youssef',
      lastName: 'El Amrani',
      phone: '+212600000001',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`  ✅ SuperAdmin created: ${superAdmin.email}`);

  // ── Tenants ──────────────────────────────────────────────
  const tenantHotel = await prisma.tenant.create({
    data: {
      name: 'Atlas Grand Hôtel',
      slug: 'atlas-grand-hotel',
      domain: 'atlas-grand.smartcity.ma',
      type: TenantType.HOTEL,
      isActive: true,
      currency: 'MAD',
      defaultLocale: 'fr',
      timezone: 'Africa/Casablanca',
      features: ['bookings', 'room_service', 'restaurant', 'activities', 'reviews', 'qr_checkin'],
    },
  });

  const tenantRiad = await prisma.tenant.create({
    data: {
      name: 'Riad Jardin Secret',
      slug: 'riad-jardin-secret',
      domain: 'jardin-secret.smartcity.ma',
      type: TenantType.RIAD,
      isActive: true,
      currency: 'MAD',
      defaultLocale: 'fr',
      timezone: 'Africa/Casablanca',
      features: ['bookings', 'restaurant', 'activities', 'reviews', 'qr_checkin'],
    },
  });
  console.log(`  ✅ Tenants created: ${tenantHotel.name}, ${tenantRiad.name}`);

  // ── Tenant managers ──────────────────────────────────────
  await prisma.user.create({
    data: {
      email: 'manager@atlas-grand.ma',
      passwordHash: hashPassword('Manager123!'),
      firstName: 'Fatima',
      lastName: 'Benali',
      phone: '+212661234567',
      role: UserRole.MANAGER,
      tenantId: tenantHotel.id,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      email: 'manager@jardin-secret.ma',
      passwordHash: hashPassword('Manager123!'),
      firstName: 'Karim',
      lastName: 'Tazi',
      phone: '+212662345678',
      role: UserRole.MANAGER,
      tenantId: tenantRiad.id,
      isActive: true,
    },
  });

  // ── Guest users ──────────────────────────────────────────
  const guest1 = await prisma.user.create({
    data: {
      email: 'sophie.martin@email.com',
      passwordHash: hashPassword('Guest123!'),
      firstName: 'Sophie',
      lastName: 'Martin',
      phone: '+33612345678',
      role: UserRole.GUEST,
      isActive: true,
    },
  });

  const guest2 = await prisma.user.create({
    data: {
      email: 'ahmed.khalil@email.com',
      passwordHash: hashPassword('Guest123!'),
      firstName: 'Ahmed',
      lastName: 'Khalil',
      phone: '+212670123456',
      role: UserRole.GUEST,
      isActive: true,
    },
  });

  // ── Hotels ───────────────────────────────────────────────
  const hotel1 = await prisma.hotel.create({
    data: {
      tenantId: tenantHotel.id,
      name: 'Atlas Grand Hôtel Marrakech',
      description:
        "Situé au cœur de la ville ocre, l'Atlas Grand Hôtel offre une expérience luxueuse avec vue imprenable sur les montagnes de l'Atlas. Piscine extérieure, spa traditionnel et cuisine gastronomique marocaine.",
      type: TenantType.HOTEL,
      address: '45 Avenue Mohammed V, Guéliz',
      city: 'Marrakech',
      lat: 31.6295,
      lng: -7.9811,
      images: [
        '/images/hotels/atlas-grand-1.jpg',
        '/images/hotels/atlas-grand-2.jpg',
        '/images/hotels/atlas-grand-3.jpg',
      ],
      amenities: ['wifi', 'pool', 'spa', 'restaurant', 'bar', 'parking', 'gym', 'hammam', 'concierge', 'room_service'],
      rating: 4.7,
      reviewCount: 234,
      priceRange: '1200-4500 MAD',
      contactPhone: '+212524401234',
      contactEmail: 'contact@atlas-grand.ma',
      isActive: true,
    },
  });

  const hotel2 = await prisma.hotel.create({
    data: {
      tenantId: tenantHotel.id,
      name: 'Atlas Grand Hôtel Essaouira',
      description:
        "Face à l'océan Atlantique, notre établissement d'Essaouira combine le charme de la cité des alizés avec le confort moderne. Terrasse panoramique, restaurant de fruits de mer et accès direct à la plage.",
      type: TenantType.HOTEL,
      address: '12 Boulevard Mohammed V, Médina',
      city: 'Essaouira',
      lat: 31.5085,
      lng: -9.7595,
      images: [
        '/images/hotels/atlas-essaouira-1.jpg',
        '/images/hotels/atlas-essaouira-2.jpg',
      ],
      amenities: ['wifi', 'restaurant', 'bar', 'parking', 'sea_view', 'terrace', 'concierge'],
      rating: 4.5,
      reviewCount: 156,
      priceRange: '900-3200 MAD',
      contactPhone: '+212524785678',
      contactEmail: 'essaouira@atlas-grand.ma',
      isActive: true,
    },
  });

  const hotel3 = await prisma.hotel.create({
    data: {
      tenantId: tenantRiad.id,
      name: 'Riad Jardin Secret',
      description:
        "Niché dans les ruelles de la médina de Marrakech, le Riad Jardin Secret est un havre de paix avec son jardin intérieur luxuriant, sa fontaine en zellige et ses chambres décorées dans la pure tradition artisanale marocaine.",
      type: TenantType.RIAD,
      address: '78 Derb El Hammam, Médina',
      city: 'Marrakech',
      lat: 31.6312,
      lng: -7.9863,
      images: [
        '/images/hotels/riad-jardin-1.jpg',
        '/images/hotels/riad-jardin-2.jpg',
        '/images/hotels/riad-jardin-3.jpg',
      ],
      amenities: ['wifi', 'pool', 'hammam', 'restaurant', 'terrace', 'garden', 'air_conditioning', 'concierge'],
      rating: 4.9,
      reviewCount: 312,
      priceRange: '1500-5000 MAD',
      contactPhone: '+212524389012',
      contactEmail: 'contact@jardin-secret.ma',
      isActive: true,
    },
  });
  console.log(`  ✅ Hotels created: ${hotel1.name}, ${hotel2.name}, ${hotel3.name}`);

  // ── Rooms ────────────────────────────────────────────────
  const roomsData = [
    // Hotel 1 rooms
    { hotelId: hotel1.id, name: 'Chambre Atlas Standard', type: RoomType.DOUBLE, description: 'Chambre confortable avec vue sur le jardin, lit double, salle de bain privée avec douche à l\'italienne.', price: 1200, capacity: 2, amenities: ['wifi', 'air_conditioning', 'minibar', 'safe'], images: ['/images/rooms/atlas-standard-1.jpg'] },
    { hotelId: hotel1.id, name: 'Suite Impériale', type: RoomType.SUITE, description: 'Suite spacieuse avec salon séparé, terrasse privée avec vue panoramique sur l\'Atlas, jacuzzi et service de majordome.', price: 4500, capacity: 3, amenities: ['wifi', 'air_conditioning', 'minibar', 'safe', 'balcony', 'mountain_view', 'room_service'], images: ['/images/rooms/atlas-suite-1.jpg'] },
    { hotelId: hotel1.id, name: 'Chambre Familiale Koutoubia', type: RoomType.FAMILY, description: 'Grande chambre familiale avec deux lits doubles, coin enfants et vue sur la Koutoubia.', price: 2800, capacity: 5, amenities: ['wifi', 'air_conditioning', 'minibar', 'safe'], images: ['/images/rooms/atlas-family-1.jpg'] },
    // Hotel 2 rooms
    { hotelId: hotel2.id, name: 'Chambre Océan', type: RoomType.DOUBLE, description: 'Chambre lumineuse avec vue directe sur l\'océan Atlantique et balcon privé.', price: 1400, capacity: 2, amenities: ['wifi', 'air_conditioning', 'minibar', 'sea_view', 'balcony'], images: ['/images/rooms/essaouira-ocean-1.jpg'] },
    { hotelId: hotel2.id, name: 'Suite Mogador', type: RoomType.SUITE, description: 'Suite élégante inspirée de l\'histoire de Mogador, avec salon marocain et terrasse vue mer.', price: 3200, capacity: 3, amenities: ['wifi', 'air_conditioning', 'minibar', 'safe', 'sea_view', 'terrace'], images: ['/images/rooms/essaouira-suite-1.jpg'] },
    { hotelId: hotel2.id, name: 'Chambre Single Médina', type: RoomType.SINGLE, description: 'Chambre cosy pour voyageur solo, décoration traditionnelle et vue sur la médina.', price: 900, capacity: 1, amenities: ['wifi', 'air_conditioning'], images: ['/images/rooms/essaouira-single-1.jpg'] },
    // Hotel 3 rooms (Riad)
    { hotelId: hotel3.id, name: 'Chambre Jasmin', type: RoomType.DOUBLE, description: 'Chambre romantique donnant sur le patio central, décorée de tadelakt et zellige traditionnels.', price: 1500, capacity: 2, amenities: ['wifi', 'air_conditioning', 'garden'], images: ['/images/rooms/riad-jasmin-1.jpg'] },
    { hotelId: hotel3.id, name: 'Suite Royale', type: RoomType.SUITE, description: 'La plus belle suite du riad avec cheminée, salon privé, terrasse sur le toit et vue sur les toits de la médina.', price: 5000, capacity: 2, amenities: ['wifi', 'air_conditioning', 'minibar', 'terrace', 'mountain_view', 'room_service'], images: ['/images/rooms/riad-royale-1.jpg'] },
    { hotelId: hotel3.id, name: 'Chambre Menthe', type: RoomType.TWIN, description: 'Chambre fraîche aux tons verts avec deux lits simples, idéale pour les amis voyageant ensemble.', price: 1800, capacity: 2, amenities: ['wifi', 'air_conditioning', 'garden'], images: ['/images/rooms/riad-menthe-1.jpg'] },
  ];

  const rooms = [];
  for (const roomData of roomsData) {
    const room = await prisma.room.create({ data: { ...roomData, currency: 'MAD' } });
    rooms.push(room);
  }
  console.log(`  ✅ ${rooms.length} rooms created`);

  // ── Restaurants ──────────────────────────────────────────
  const restaurantsData = [
    {
      hotelId: hotel1.id,
      name: 'Le Jardin d\'Orient',
      description: 'Restaurant gastronomique proposant une cuisine marocaine raffinée avec des produits locaux et de saison. Tajines, couscous et pâtisseries traditionnelles.',
      cuisine: ['Marocaine', 'Méditerranéenne'],
      priceRange: '200-500 MAD',
      images: ['/images/restaurants/jardin-orient-1.jpg'],
      openingHours: '12:00-15:00, 19:00-23:00',
      isActive: true,
    },
    {
      hotelId: hotel2.id,
      name: 'La Table de l\'Océan',
      description: 'Restaurant de fruits de mer avec terrasse face à l\'Atlantique. Poissons frais du jour, plateaux de fruits de mer et spécialités souiries.',
      cuisine: ['Fruits de mer', 'Marocaine', 'Internationale'],
      priceRange: '250-600 MAD',
      images: ['/images/restaurants/table-ocean-1.jpg'],
      openingHours: '12:00-15:30, 19:00-22:30',
      isActive: true,
    },
    {
      hotelId: hotel3.id,
      name: 'La Cour du Riad',
      description: 'Dîner intime dans le patio du riad, sous les étoiles. Menu dégustation de 5 plats préparé par notre chef avec les épices du souk.',
      cuisine: ['Marocaine traditionnelle', 'Fusion'],
      priceRange: '300-700 MAD',
      images: ['/images/restaurants/cour-riad-1.jpg'],
      openingHours: '19:30-22:00',
      isActive: true,
    },
  ];

  for (const data of restaurantsData) {
    await prisma.restaurant.create({ data });
  }
  console.log(`  ✅ ${restaurantsData.length} restaurants created`);

  // ── Activities ───────────────────────────────────────────
  const activitiesData = [
    // Hotel 1
    { hotelId: hotel1.id, name: 'Excursion dans l\'Atlas', type: ActivityType.EXCURSION, description: 'Randonnée guidée d\'une journée dans les montagnes de l\'Atlas avec déjeuner berbère traditionnel dans un village de montagne.', price: 650, duration: '8 heures', maxParticipants: 12, images: ['/images/activities/atlas-trek-1.jpg'], isAvailable: true },
    { hotelId: hotel1.id, name: 'Séance Hammam & Massage', type: ActivityType.WELLNESS, description: 'Rituel de hammam traditionnel suivi d\'un massage relaxant aux huiles d\'argan. Gommage au savon noir inclus.', price: 450, duration: '2 heures', maxParticipants: 4, images: ['/images/activities/hammam-1.jpg'], isAvailable: true },
    { hotelId: hotel1.id, name: 'Cours de cuisine marocaine', type: ActivityType.CULINARY, description: 'Apprenez à préparer un tajine et des pastillas avec notre chef. Visite du marché local et dégustation incluses.', price: 350, duration: '3 heures', maxParticipants: 8, images: ['/images/activities/cooking-1.jpg'], isAvailable: true },
    // Hotel 2
    { hotelId: hotel2.id, name: 'Surf à Essaouira', type: ActivityType.SPORT, description: 'Cours de surf pour tous niveaux sur la plage d\'Essaouira. Matériel fourni et moniteur certifié.', price: 300, duration: '2 heures', maxParticipants: 6, images: ['/images/activities/surf-1.jpg'], isAvailable: true },
    { hotelId: hotel2.id, name: 'Visite guidée de la Médina', type: ActivityType.CULTURAL, description: 'Découverte de la médina classée UNESCO, des remparts portugais, du port de pêche et des galeries d\'art.', price: 200, duration: '3 heures', maxParticipants: 15, images: ['/images/activities/medina-tour-1.jpg'], isAvailable: true },
    { hotelId: hotel2.id, name: 'Sortie en bateau', type: ActivityType.ADVENTURE, description: 'Excursion en bateau traditionnel le long de la côte avec observation des îles Purpuraires et des faucons d\'Éléonore.', price: 400, duration: '2 heures', maxParticipants: 10, images: ['/images/activities/boat-1.jpg'], isAvailable: true },
    // Hotel 3 (Riad)
    { hotelId: hotel3.id, name: 'Atelier de zellige', type: ActivityType.WORKSHOP, description: 'Initiez-vous à l\'art ancestral du zellige marocain avec un maître artisan de la médina.', price: 280, duration: '2 heures', maxParticipants: 6, images: ['/images/activities/zellige-1.jpg'], isAvailable: true },
    { hotelId: hotel3.id, name: 'Balade en calèche', type: ActivityType.CULTURAL, description: 'Tour de Marrakech en calèche traditionnelle : Koutoubia, jardins de la Ménara, remparts et palais.', price: 250, duration: '1h30', maxParticipants: 4, images: ['/images/activities/caleche-1.jpg'], isAvailable: true },
    { hotelId: hotel3.id, name: 'Soirée spectacle Fantasia', type: ActivityType.ENTERTAINMENT, description: 'Dîner-spectacle avec cavaliers, musiciens gnaoua et danseuses. Transport inclus.', price: 550, duration: '4 heures', maxParticipants: 20, images: ['/images/activities/fantasia-1.jpg'], isAvailable: true },
  ];

  for (const data of activitiesData) {
    await prisma.activity.create({ data });
  }
  console.log(`  ✅ ${activitiesData.length} activities created`);

  // ── Reviews ──────────────────────────────────────────────
  const reviewsData = [
    { guestId: guest1.id, hotelId: hotel1.id, rating: 5, comment: 'Séjour exceptionnel ! Le personnel est aux petits soins, la piscine est magnifique et le restaurant propose une cuisine délicieuse. La vue sur l\'Atlas depuis la suite est à couper le souffle.', cleanliness: 5, service: 5, location: 5, value: 4 },
    { guestId: guest2.id, hotelId: hotel1.id, rating: 4, comment: 'Très bon hôtel, bien situé à Guéliz. Le hammam est authentique et relaxant. Petit bémol sur le petit-déjeuner qui pourrait être plus varié.', cleanliness: 4, service: 5, location: 5, value: 4 },
    { guestId: guest1.id, hotelId: hotel2.id, rating: 4, comment: 'L\'emplacement face à l\'océan est parfait. Les chambres sont propres et bien décorées. Le restaurant de fruits de mer est excellent.', cleanliness: 5, service: 4, location: 5, value: 4 },
    { guestId: guest2.id, hotelId: hotel3.id, rating: 5, comment: 'Le plus beau riad de Marrakech ! L\'architecture est sublime, le jardin intérieur est un vrai paradis. Le dîner sur la terrasse sous les étoiles est inoubliable.', cleanliness: 5, service: 5, location: 5, value: 5 },
    { guestId: guest1.id, hotelId: hotel3.id, rating: 5, comment: 'Une expérience magique dans ce riad authentique. L\'accueil est chaleureux, le thé à la menthe délicieux et la chambre Jasmin est un bijou de décoration traditionnelle.', cleanliness: 5, service: 5, location: 4, value: 5 },
  ];

  for (const data of reviewsData) {
    await prisma.review.create({ data });
  }
  console.log(`  ✅ ${reviewsData.length} reviews created`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
