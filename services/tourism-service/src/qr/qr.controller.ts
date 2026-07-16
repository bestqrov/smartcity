import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { QrService } from './qr.service';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { ValidateQrDto } from './dto/validate-qr.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('generate')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async generate(@Body() dto: GenerateQrDto) {
    return this.qrService.generate(dto);
  }

  @Post('validate')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async validate(@Body() dto: ValidateQrDto) {
    return this.qrService.validate(dto);
  }

  @Get(':bookingId')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'GUEST')
  async findByBooking(@Param('bookingId') bookingId: string) {
    return this.qrService.findByBooking(bookingId);
  }
}
