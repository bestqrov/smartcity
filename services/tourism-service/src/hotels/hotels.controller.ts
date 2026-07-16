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
import { HotelsService } from './hotels.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { SearchHotelDto } from './dto/search-hotel.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateHotelDto) {
    return this.hotelsService.create(dto);
  }

  @Get('search')
  @Public()
  async search(@Query() query: SearchHotelDto) {
    return this.hotelsService.search(query);
  }

  @Get('nearby')
  @Public()
  async nearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.hotelsService.findNearby(lat, lng, radius || 10);
  }

  @Get()
  @Public()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('city') city?: string,
    @Query('type') type?: string,
    @Query('minRating') minRating?: number,
    @Query('maxPrice') maxPrice?: string,
  ) {
    return this.hotelsService.findAll({
      page: page || 1,
      limit: limit || 20,
      city,
      type,
      minRating,
      maxPrice,
    });
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.hotelsService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(@Param('id') id: string, @Body() dto: UpdateHotelDto) {
    return this.hotelsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.hotelsService.softDelete(id);
  }
}
