import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SearchOrderDto } from './dto/search-order.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';
import { BookingsService } from '../bookings/bookings.service';

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'STAFF'];

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: CurrentUserDto) {
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';

    if (!isStaff) {
      const booking = await this.bookingsService.findById(dto.bookingId);
      if (booking.guestId !== user.userId) {
        throw new ForbiddenException('You cannot order for this booking');
      }
    }

    return this.ordersService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findAll(@Query() query: SearchOrderDto, @CurrentUser() user: CurrentUserDto) {
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';

    if (!isStaff) {
      if (!query.bookingId) {
        throw new BadRequestException('bookingId is required');
      }
      const booking = await this.bookingsService.findById(query.bookingId);
      if (booking.guestId !== user.userId) {
        throw new ForbiddenException('You cannot access these orders');
      }
      return this.ordersService.findAll(query);
    }

    const tenantId = user.role === 'SUPER_ADMIN' ? undefined : user.tenantId;
    return this.ordersService.findAll({ ...query, tenantId });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    const order = await this.ordersService.findById(id);
    const isStaff = STAFF_ROLES.includes(user.role) || user.role === 'SUPER_ADMIN';

    if (!isStaff) {
      const booking = await this.bookingsService.findById(order.bookingId);
      if (booking.guestId !== user.userId) {
        throw new ForbiddenException('You cannot access this order');
      }
    } else {
      this.assertTenantOwnership(order, user);
    }

    return order;
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    const order = await this.ordersService.findById(id);
    this.assertTenantOwnership(order, user);
    return this.ordersService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    const order = await this.ordersService.findById(id);
    this.assertTenantOwnership(order, user);
    return this.ordersService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    const order = await this.ordersService.findById(id);
    this.assertTenantOwnership(order, user);
    return this.ordersService.remove(id);
  }

  private assertTenantOwnership(
    order: { booking: { hotel?: { tenantId: string } | null } },
    user: CurrentUserDto,
  ) {
    if (user.role === 'SUPER_ADMIN') return;

    if (order.booking.hotel?.tenantId !== user.tenantId) {
      throw new ForbiddenException('You do not have access to this order');
    }
  }
}
