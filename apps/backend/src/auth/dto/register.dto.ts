import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'newplayer@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    example: 'securePass1!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: 'Display name shown in the UI',
    example: 'Aragorn the Ranger',
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({
    description: 'UUID invite token received via email',
    example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    format: 'uuid',
  })
  @IsString()
  @IsUUID()
  inviteToken: string;
}
