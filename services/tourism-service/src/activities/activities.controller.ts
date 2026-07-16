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
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { SearchActivityDto } from './dto/search-activity.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateActivityDto) {
    return this.activitiesService.create(dto);
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
  ) {
    return this.activitiesService.findAllPublic(page || 1, limit || 20);
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
  async update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activitiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.activitiesService.remove(id);
  }
}
