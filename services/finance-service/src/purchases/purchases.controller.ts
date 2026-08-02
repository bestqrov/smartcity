import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { SearchPurchaseDto } from './dto/search-purchase.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchPurchaseDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.purchasesService.findOne(user.tenantId, id);
  }
}
