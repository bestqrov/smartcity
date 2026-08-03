import { IsIn } from 'class-validator';

export class UpdatePurchaseStatusDto {
  @IsIn(['RECEIVED', 'CANCELLED'])
  status: 'RECEIVED' | 'CANCELLED';
}
