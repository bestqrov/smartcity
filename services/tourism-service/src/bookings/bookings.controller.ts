import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SearchBookingDto } from './dto/search-booking.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(@Query() query: SearchBookingDto) {
    return this.bookingsService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findById(id);
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
