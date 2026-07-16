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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SearchOrderDto } from './dto/search-order.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(@Query() query: SearchOrderDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.ordersService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
