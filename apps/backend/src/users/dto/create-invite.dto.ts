import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({
    description: 'Email address to send the invite to',
    example: 'newgamemaster@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;
}
