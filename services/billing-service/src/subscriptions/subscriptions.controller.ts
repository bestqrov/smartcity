import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  async findAll() {
    return this.subscriptionsService.findAll();
  }

  @Get('tenant/:tenantId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async findByTenant(@Param('tenantId') tenantId: string) {
    return this.subscriptionsService.findByTenant(tenantId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id);
  }
}
