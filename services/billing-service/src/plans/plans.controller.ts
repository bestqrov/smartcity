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
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Get()
  @Public()
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.plansService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
