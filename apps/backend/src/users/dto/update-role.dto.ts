import { IsEnum } from 'class-validator';
import { UserRole } from '../../../generated/prisma';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
