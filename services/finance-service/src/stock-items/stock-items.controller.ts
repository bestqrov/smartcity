import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { StockItemsService } from './stock-items.service';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { SearchStockItemDto } from './dto/search-stock-item.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { SearchStockMovementDto } from './dto/search-stock-movement.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('stock-items')
export class StockItemsController {
  constructor(
    private readonly stockItemsService: StockItemsService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateStockItemDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.create(user.tenantId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findAll(@Query() query: SearchStockItemDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockItemsService.remove(user.tenantId, id);
  }

  @Post(':id/movements')
  @Roles('ADMIN', 'MANAGER')
  async createMovement(
    @Param('id') id: string,
    @Body() dto: CreateStockMovementDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockMovementsService.create(user.tenantId, id, user.userId, dto);
  }

  @Get(':id/movements')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async findMovements(
    @Param('id') id: string,
    @Query() query: SearchStockMovementDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    return this.stockMovementsService.findAll(user.tenantId, id, query);
  }
}
