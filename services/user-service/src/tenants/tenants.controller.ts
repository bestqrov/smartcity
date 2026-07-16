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
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async create(@Body() data: Record<string, any>) {
    return this.tenantsService.create(data);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenantsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: Record<string, any>) {
    return this.tenantsService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.tenantsService.softDelete(id);
  }
}
