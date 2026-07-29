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
    return this.bookingsService.findAll({
      ...query,
      guestId: isStaff ? query.guestId : user.userId,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    const booking = await this.bookingsService.findById(id);
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';

    if (!isStaff && booking.guestId !== user.userId) {
      throw new ForbiddenException('You cannot access this booking');
    }

    return booking;
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.bookingsService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
