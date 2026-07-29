import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @MinLength(1)
  text: string;
}
