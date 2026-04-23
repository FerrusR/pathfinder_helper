import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { CampaignRole } from '../../../generated/prisma';

export class AddMemberDto {
  @ApiProperty({ description: 'UUID of the user to add', format: 'uuid' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: CampaignRole, description: 'Role to assign' })
  @IsEnum(CampaignRole)
  role: CampaignRole;
}
