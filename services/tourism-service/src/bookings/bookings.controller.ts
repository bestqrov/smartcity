import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SearchBookingDto } from './dto/search-booking.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'STAFF'];

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findAll(
    @Query() query: SearchBookingDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';

    if (!isStaff) {
      return this.bookingsService.findAll({ ...query, guestId: user.userId });
    }

    const tenantId = user.role === 'SUPER_ADMIN' ? undefined : user.tenantId;
    return this.bookingsService.findAll({ ...query, tenantId });
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async stats(@Query('days') days: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      return { dailyRevenue: [], totalRevenue: 0, occupancyRate: 0, totalRooms: 0, occupiedRooms: 0 };
    }
    const parsedDays = Math.min(Math.max(parseInt(days, 10) || 7, 1), 90);
    return this.bookingsService.getStats(user.tenantId, parsedDays);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    const booking = await this.bookingsService.findById(id);
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';

    if (!isStaff) {
      if (booking.guestId !== user.userId) {
        throw new ForbiddenException('You cannot access this booking');
      }
    } else {
      this.assertTenantOwnership(booking, user);
    }

    return booking;
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    const booking = await this.bookingsService.findById(id);
    this.assertTenantOwnership(booking, user);
    return this.bookingsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    const booking = await this.bookingsService.findById(id);
    this.assertTenantOwnership(booking, user);
    return this.bookingsService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    const booking = await this.bookingsService.findById(id);
    this.assertTenantOwnership(booking, user);
    return this.bookingsService.remove(id);
  }

  private assertTenantOwnership(
    booking: { hotel: { tenantId?: string } },
    user: CurrentUserDto,
  ) {
    if (user.role === 'SUPER_ADMIN') return;

    if (booking.hotel.tenantId !== user.tenantId) {
      throw new ForbiddenException('You do not have access to this booking');
    }
  }
}
