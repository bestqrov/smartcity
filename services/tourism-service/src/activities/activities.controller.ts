import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { SearchActivityDto } from './dto/search-activity.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserDto } from '../auth/jwt.strategy';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateActivityDto, @CurrentUser() user: CurrentUserDto) {
    if (!user.tenantId) {
      throw new BadRequestException('Your account is not linked to a tenant');
    }
    if (!dto.hotelId && !dto.city) {
      throw new BadRequestException('Either hotelId or city is required');
    }

    return this.activitiesService.create(dto, user.tenantId);
  }

  @Get('search')
  @Public()
  async search(@Query() query: SearchActivityDto) {
    return this.activitiesService.search(query);
  }

  @Get()
  @Public()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('city') city?: string,
  ) {
    return this.activitiesService.findAllPublic(page || 1, limit || 20, city);
  }

  @Get(':hotelId/hotel')
  @Public()
  async findByHotel(
    @Param('hotelId') hotelId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activitiesService.findAll(hotelId, page || 1, limit || 20);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.activitiesService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: CurrentUserDto,
  ) {
    await this.assertOwnership(id, user);
    return this.activitiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    await this.assertOwnership(id, user);
    return this.activitiesService.remove(id);
  }

  private async assertOwnership(id: string, user: CurrentUserDto) {
    if (user.role === 'SUPER_ADMIN') return;

    const activity = await this.activitiesService.findById(id);
    if (activity.tenantId !== user.tenantId) {
      throw new ForbiddenException('You do not own this listing');
    }
  }
}
