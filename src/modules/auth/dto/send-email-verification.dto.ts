import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendEmailVerificationDto {
  @ApiProperty({ example: 'store@example.com' })
  @IsEmail()
  email: string;
}
