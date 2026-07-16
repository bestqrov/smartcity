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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { SearchReviewDto } from './dto/search-review.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async create(@Body() dto: CreateReviewDto) {
    return this.reviewsService.create(dto);
  }

  @Get()
  @Public()
  async findAll(@Query() query: SearchReviewDto) {
    return this.reviewsService.findAll(query);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
