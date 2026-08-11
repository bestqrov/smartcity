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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requireTenantId } from '../common/tenant.util';
import type { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(requireTenantId(user), dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.branchesService.findAll(requireTenantId(user), {
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.branchesService.findById(requireTenantId(user), id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(requireTenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.branchesService.deactivate(requireTenantId(user), id);
  }
}
