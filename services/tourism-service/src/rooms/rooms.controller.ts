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
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { SearchRoomDto } from './dto/search-room.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Get('search')
  @Public()
  async search(@Query() query: SearchRoomDto) {
    return this.roomsService.search(query);
  }

  @Get()
  @Public()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.roomsService.findAllPublic(page || 1, limit || 20);
  }

  @Get(':hotelId/hotel')
  @Public()
  async findByHotel(
    @Param('hotelId') hotelId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.roomsService.findAll(hotelId, page || 1, limit || 20);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}
