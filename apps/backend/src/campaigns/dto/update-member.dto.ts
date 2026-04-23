import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CampaignRole } from '../../../generated/prisma';

export class UpdateMemberDto {
  @ApiProperty({ enum: CampaignRole, description: 'New role to assign' })
  @IsEnum(CampaignRole)
  role: CampaignRole;
}
