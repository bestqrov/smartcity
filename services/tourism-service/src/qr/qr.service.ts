import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../common/prisma.service';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { ValidateQrDto } from './dto/validate-qr.dto';

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(dto: GenerateQrDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        hotel: {
          select: { id: true, name: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const payload = JSON.stringify({
      bookingId: booking.id,
      guestId: booking.guestId,
      hotelId: booking.hotelId,
      roomId: booking.roomId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
    });

    const dataUrl = await QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    await this.prisma.booking.update({
      where: { id: dto.bookingId },
      data: { qrCode: dataUrl },
    });

    return {
      bookingId: booking.id,
      qrCode: dataUrl,
      booking,
    };
  }

  async findByBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, qrCode: true, status: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async validate(dto: ValidateQrDto) {
    let payload: Record<string, any>;

    try {
      payload = JSON.parse(dto.qrData);
    } catch {
      throw new BadRequestException('Invalid QR code data');
    }

    const bookingId = payload.bookingId;

    if (!bookingId) {
      throw new BadRequestException('QR code is missing booking information');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        hotel: {
          select: { id: true, name: true, city: true, address: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('This booking has been cancelled');
    }

    if (booking.status === 'CHECKED_OUT') {
      throw new BadRequestException('This booking has already been checked out');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkIn = new Date(booking.checkIn);
    checkIn.setHours(0, 0, 0, 0);

    const checkOut = new Date(booking.checkOut);
    checkOut.setHours(0, 0, 0, 0);

    if (today < checkIn) {
      throw new BadRequestException('Check-in is not available yet');
    }

    if (today > checkOut) {
      throw new BadRequestException('This booking has expired');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CHECKED_IN' },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        hotel: {
          select: { id: true, name: true, city: true, address: true },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      valid: true,
      message: 'Check-in successful',
      booking: updatedBooking,
    };
  }
}
