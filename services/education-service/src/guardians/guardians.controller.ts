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
import { GuardiansService } from './guardians.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateGuardianDto) {
    return this.guardiansService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.guardiansService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.guardiansService.findById(requireTenantId(user), id);
  }

  @Get(':id/students')
  async findStudents(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.guardiansService.findStudents(requireTenantId(user), id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    return this.guardiansService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.guardiansService.deactivate(requireTenantId(user), id);
  }
}
