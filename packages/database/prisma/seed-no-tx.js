const { PrismaClient, UserRole, TenantType, RoomType, ActivityType } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

async function deleteCollection(model) {
  try {
    const count = await model.count();
    if (count === 0) return;
    const items = await model.findMany({ select: { id: true } });
    for (const item of items) {
      try {
        await model.delete({ where: { id: item.id } });
      } catch (e) {
        // ignore foreign key-like errors
      }
    }
  } catch (e) {
    console.log('skip collection', e.message);
  }
}

async function main() {
  console.log('🌱 Seeding SmartCity database...');

  await deleteCollection(prisma.review);
  await deleteCollection(prisma.booking);
  await deleteCollection(prisma.serviceOrder);
  await deleteCollection(prisma.room);
  await deleteCollection(prisma.activity);
  await deleteCollection(prisma.restaurant);
  await deleteCollection(prisma.session);
  await deleteCollection(prisma.hotel);
  await deleteCollection(prisma.user);
  await deleteCollection(prisma.tenant);

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

  await prisma.user.create({
    data: {
      email: 'manager@smartcity.ma',
      passwordHash: hashPassword('Manager123!'),
      firstName: 'Fatima',
      lastName: 'Benali',
      phone: '+212600000002',
      role: UserRole.MANAGER,
      tenantId: tenantHotel.id,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      email: 'staff@smartcity.ma',
      passwordHash: hashPassword('Manager123!'),
      firstName: 'Karim',
      lastName: 'Ouazzani',
      phone: '+212600000003',
      role: UserRole.STAFF,
      tenantId: tenantRiad.id,
      isActive: true,
    },
  });

  const guest1 = await prisma.user.create({
    data: {
      email: 'guest@smartcity.ma',
      passwordHash: hashPassword('Guest123!'),
      firstName: 'Sophie',
      lastName: 'Martin',
      phone: '+212600000004',
      role: UserRole.GUEST,
      isActive: true,
    },
  });

  const guest2 = await prisma.user.create({
    data: {
      email: 'ahmed.tour@example.com',
      passwordHash: hashPassword('Guest123!'),
      firstName: 'Ahmed',
      lastName: 'Tourabi',
      phone: '+212600000005',
      role: UserRole.GUEST,
      isActive: true,
    },
  });

  console.log(`  ✅ Users created`);

  const hotel1 = await prisma.hotel.create({
    data: {
      tenantId: tenantHotel.id,
      name: 'Atlas Grand Hôtel Marrakech',
      description: "Situé au cœur de la ville ocre, l'Atlas Grand Hôtel offre une expérience luxueuse avec vue imprenable sur les montagnes de l'Atlas.",
      type: TenantType.HOTEL,
      address: '45 Avenue Mohammed V, Guéliz',
      city: 'Marrakech',
      lat: 31.6295,
      lng: -7.9811,
      images: ['/images/hotels/atlas-grand-1.jpg', '/images/hotels/atlas-grand-2.jpg', '/images/hotels/atlas-grand-3.jpg'],
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
      description: "Face à l'océan Atlantique, notre établissement d'Essaouira combine le charme de la cité des alizés avec le confort moderne.",
      type: TenantType.HOTEL,
      address: '12 Boulevard Mohammed V, Médina',
      city: 'Essaouira',
      lat: 31.5085,
      lng: -9.7595,
      images: ['/images/hotels/atlas-essaouira-1.jpg', '/images/hotels/atlas-essaouira-2.jpg'],
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
      description: 'Niché dans les ruelles de la médina de Marrakech, le Riad Jardin Secret est un havre de paix.',
      type: TenantType.RIAD,
      address: '78 Derb El Hammam, Médina',
      city: 'Marrakech',
      lat: 31.6312,
      lng: -7.9863,
      images: ['/images/hotels/riad-jardin-1.jpg', '/images/hotels/riad-jardin-2.jpg', '/images/hotels/riad-jardin-3.jpg'],
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

  const roomTypes = [RoomType.SINGLE, RoomType.DOUBLE, RoomType.TWIN, RoomType.SUITE, RoomType.DELUXE, RoomType.FAMILY, RoomType.PENTHOUSE, RoomType.DORMITORY];
  const roomData = [];
  for (const hotel of [hotel1, hotel2, hotel3]) {
    for (let i = 0; i < 3; i++) {
      roomData.push({
        hotelId: hotel.id,
        name: `Chambre ${roomTypes[i]} ${i + 1}`,
        type: roomTypes[i],
        description: `Belle chambre ${roomTypes[i].toLowerCase()} avec vue`,
        price: 800 + i * 400,
        capacity: 1 + i,
        amenities: ['wifi', 'tv', 'minibar', 'air_conditioning'],
        images: [`/images/rooms/${roomTypes[i].toLowerCase()}-${i + 1}.jpg`],
        isAvailable: true,
      });
    }
  }
  await prisma.room.createMany({ data: roomData });
  console.log(`  ✅ ${roomData.length} rooms created`);

  const restaurants = [
    { hotelId: hotel1.id, name: 'Le Comptoir Marrakchi', cuisine: ['marocaine', 'internationale'], priceRange: '$$$' },
    { hotelId: hotel2.id, name: 'Les Alizés', cuisine: ['fruits de mer', 'méditerranéenne'], priceRange: '$$$' },
    { hotelId: hotel3.id, name: 'Jardin Secret Restaurant', cuisine: ['marocaine', 'fusion'], priceRange: '$$$$' },
  ];
  for (const r of restaurants) {
    await prisma.restaurant.create({
      data: {
        ...r,
        description: 'Restaurant raffiné dans un cadre exceptionnel',
        images: ['/images/restaurants/default.jpg'],
        openingHours: '12:00-15:00, 19:00-23:00',
        isActive: true,
      },
    });
  }
  console.log(`  ✅ ${restaurants.length} restaurants created`);

  const activities = [
    { hotelId: hotel1.id, name: 'Excursion Atlas', type: ActivityType.EXCURSION, price: 1200, duration: '8h', maxParticipants: 12 },
    { hotelId: hotel1.id, name: 'Spa Hammam', type: ActivityType.WELLNESS, price: 600, duration: '2h', maxParticipants: 4 },
    { hotelId: hotel1.id, name: 'Cours de cuisine', type: ActivityType.CULINARY, price: 800, duration: '3h', maxParticipants: 8 },
    { hotelId: hotel2.id, name: 'Surf Essaouira', type: ActivityType.SPORT, price: 500, duration: '3h', maxParticipants: 6 },
    { hotelId: hotel2.id, name: 'Visite médina', type: ActivityType.CULTURAL, price: 400, duration: '2h', maxParticipants: 10 },
    { hotelId: hotel2.id, name: 'Yoga plage', type: ActivityType.WELLNESS, price: 350, duration: '1.5h', maxParticipants: 15 },
    { hotelId: hotel3.id, name: 'Atelier tadelakt', type: ActivityType.WORKSHOP, price: 700, duration: '2h', maxParticipants: 6 },
    { hotelId: hotel3.id, name: 'Soirée conteuse', type: ActivityType.ENTERTAINMENT, price: 300, duration: '1.5h', maxParticipants: 20 },
    { hotelId: hotel3.id, name: 'Randonnée palmeraie', type: ActivityType.ADVENTURE, price: 450, duration: '3h', maxParticipants: 10 },
  ];
  for (const a of activities) {
    await prisma.activity.create({
      data: {
        ...a,
        description: 'Une expérience inoubliable',
        images: ['/images/activities/default.jpg'],
        isAvailable: true,
      },
    });
  }
  console.log(`  ✅ ${activities.length} activities created`);

  const rooms = await prisma.room.findMany();
  await prisma.booking.createMany({
    data: [
      {
        guestId: guest1.id,
        hotelId: hotel1.id,
        roomId: rooms[0].id,
        checkIn: new Date('2026-08-01'),
        checkOut: new Date('2026-08-05'),
        status: 'CONFIRMED',
        totalPrice: 3200,
        guestCount: 2,
        qrCode: 'qr-booking-1',
      },
      {
        guestId: guest2.id,
        hotelId: hotel3.id,
        roomId: rooms[6].id,
        checkIn: new Date('2026-08-10'),
        checkOut: new Date('2026-08-15'),
        status: 'PENDING',
        totalPrice: 7500,
        guestCount: 2,
      },
    ],
  });
  console.log(`  ✅ 2 bookings created`);

  await prisma.review.createMany({
    data: [
      { guestId: guest1.id, hotelId: hotel1.id, rating: 5, comment: 'Excellent séjour', cleanliness: 5, service: 5, location: 4, value: 5 },
      { guestId: guest2.id, hotelId: hotel1.id, rating: 4, comment: 'Très bon hôtel', cleanliness: 4, service: 5, location: 5, value: 4 },
      { guestId: guest1.id, hotelId: hotel3.id, rating: 5, comment: 'Magique', cleanliness: 5, service: 5, location: 5, value: 4 },
      { guestId: guest2.id, hotelId: hotel2.id, rating: 4, comment: 'Belle vue', cleanliness: 4, service: 4, location: 5, value: 4 },
      { guestId: guest1.id, hotelId: hotel3.id, rating: 5, comment: 'Parfait', cleanliness: 5, service: 5, location: 5, value: 5 },
    ],
  });
  console.log(`  ✅ 5 reviews created`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
