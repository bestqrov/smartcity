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
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SearchRestaurantDto } from './dto/search-restaurant.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateRestaurantDto) {
    return this.restaurantsService.create(dto);
  }

  @Get('search')
  @Public()
  async search(@Query() query: SearchRestaurantDto) {
    return this.restaurantsService.search(query);
  }

  @Get()
  @Public()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.restaurantsService.findAllPublic(page || 1, limit || 20);
  }

  @Get(':hotelId/hotel')
  @Public()
  async findByHotel(
    @Param('hotelId') hotelId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.restaurantsService.findAll(hotelId, page || 1, limit || 20);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.restaurantsService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(@Param('id') id: string, @Body() dto: UpdateRestaurantDto) {
    return this.restaurantsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.restaurantsService.remove(id);
  }
}
