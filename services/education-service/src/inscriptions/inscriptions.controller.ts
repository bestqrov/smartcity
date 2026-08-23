import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InscriptionsService } from './inscriptions.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('inscriptions')
export class InscriptionsController {
  constructor(private readonly inscriptionsService: InscriptionsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateInscriptionDto) {
    return this.inscriptionsService.create(requireTenantId(user), dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('studentId') studentId?: string,
    @Query('type') type?: string,
  ) {
    return this.inscriptionsService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
      studentId,
      type,
    });
  }
}
