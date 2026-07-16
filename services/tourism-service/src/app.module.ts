import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HotelsModule } from './hotels/hotels.module';
import { RoomsModule } from './rooms/rooms.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { ActivitiesModule } from './activities/activities.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { QrModule } from './qr/qr.module';
import { OrdersModule } from './orders/orders.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    HotelsModule,
    RoomsModule,
    RestaurantsModule,
    ActivitiesModule,
    BookingsModule,
    ReviewsModule,
    QrModule,
    OrdersModule,
    HealthModule,
  ],
})
export class AppModule {}
