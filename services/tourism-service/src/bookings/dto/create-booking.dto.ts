import {
  IsString,
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
}

export class CreateBookingDto {
  @IsString()
  guestId: string;

  @IsString()
  hotelId: string;

  @IsString()
  roomId: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsInt()
  @Min(1)
  guestCount: number;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsString()
  @IsOptional()
  specialRequests?: string;
}
