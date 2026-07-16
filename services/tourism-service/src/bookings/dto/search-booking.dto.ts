import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { BookingStatus } from './create-booking.dto';

export class SearchBookingDto {
  @IsString()
  @IsOptional()
  guestId?: string;

  @IsString()
  @IsOptional()
  hotelId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number;
}
