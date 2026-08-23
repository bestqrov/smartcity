import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { requireTenantId } from '../common/tenant.util';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private resolveTenantScope(user: any): string | undefined {
    if (user.role === 'SUPER_ADMIN') {
      return undefined;
    }
    return requireTenantId(user);
  }

  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user?.userId;
    return this.usersService.findById(userId);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateUserDto) {
    const tenantId = requireTenantId(req.user);
    return this.usersService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
  ) {
    const tenantId = this.resolveTenantScope(req.user);
    return this.usersService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      role,
    });
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantScope(req.user);
    return this.usersService.findByIdInTenant(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
  ) {
    const tenantId = this.resolveTenantScope(req.user);
    return this.usersService.update(tenantId, id, data);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantScope(req.user);
    return this.usersService.softDelete(tenantId, id, req.user.userId);
  }
}
