import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';
import { BookingsService } from '../bookings/bookings.service';

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'STAFF'];

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async create(@Body() dto: CreateMessageDto, @CurrentUser() user: CurrentUserDto) {
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';
    const booking = await this.bookingsService.findById(dto.bookingId);

    if (isStaff) {
      if (user.role !== 'SUPER_ADMIN' && booking.hotel.tenantId !== user.tenantId) {
        throw new ForbiddenException('You cannot message on this booking');
      }
    } else if (booking.guestId !== user.userId) {
      throw new ForbiddenException('You cannot message on this booking');
    }

    return this.messagesService.create(dto, user.userId, isStaff ? 'STAFF' : 'GUEST');
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findByBooking(
    @Query('bookingId') bookingId: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!bookingId) {
      throw new BadRequestException('bookingId is required');
    }

    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';
    const booking = await this.bookingsService.findById(bookingId);

    if (isStaff) {
      if (user.role !== 'SUPER_ADMIN' && booking.hotel.tenantId !== user.tenantId) {
        throw new ForbiddenException('You cannot access these messages');
      }
    } else if (booking.guestId !== user.userId) {
      throw new ForbiddenException('You cannot access these messages');
    }

    return this.messagesService.findByBooking(bookingId, isStaff ? 'STAFF' : 'GUEST');
  }

  @Get('unread-count')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async unreadCount(@CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      return { count: 0 };
    }
    const count = await this.messagesService.unreadCountForTenant(user.tenantId);
    return { count };
  }

  @Get('conversations')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async conversations(@CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      return [];
    }
    return this.messagesService.findConversationsForTenant(user.tenantId);
  }
}
