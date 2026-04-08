import { SetMetadata } from '@nestjs/common';
import { CampaignRole } from '../../../generated/prisma';

export const CAMPAIGN_ROLE_KEY = 'campaignRole';

export const RequireCampaignRole = (...roles: CampaignRole[]) =>
  SetMetadata(CAMPAIGN_ROLE_KEY, roles);
