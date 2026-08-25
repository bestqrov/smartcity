import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { FormationsService } from './formations.service';
import { CreateFormationDto } from './dto/create-formation.dto';
import { UpdateFormationDto } from './dto/update-formation.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('formations')
export class FormationsController {
  constructor(private readonly formationsService: FormationsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateFormationDto) {
    return this.formationsService.create(requireTenantId(user), dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.formationsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get('analytics')
  @Roles('ADMIN', 'MANAGER')
  async getAnalytics(@CurrentUser() user: CurrentUserDto) {
    return this.formationsService.getAnalytics(requireTenantId(user));
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateFormationDto,
  ) {
    return this.formationsService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.formationsService.remove(requireTenantId(user), id);
  }
}
