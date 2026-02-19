import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../../generated/prisma';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'The new role to assign to the user',
    enum: UserRole,
    example: UserRole.PLAYER,
  })
  @IsEnum(UserRole)
  role: UserRole;
}
