import { IsString } from 'class-validator';

export class GenerateQrDto {
  @IsString()
  bookingId: string;
}
