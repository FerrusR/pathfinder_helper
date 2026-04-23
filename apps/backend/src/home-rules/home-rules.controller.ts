import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CampaignRole, HomeRuleStatus, UserRole } from '../../generated/prisma';
import { CurrentUser, Roles } from '../common/decorators';
import { CampaignMemberGuard, RolesGuard } from '../common/guards';
import { RequestUser } from '../common/types/request-user.type';
import { HomeRulesService } from './home-rules.service';
import { CreateHomeRuleDto } from './dto/create-home-rule.dto';
import { UpdateHomeRuleDto } from './dto/update-home-rule.dto';

interface RequestWithMember {
  campaignMember?: { role: CampaignRole };
}

// ── Campaign-scoped routes ──────────────────────────────────────────────────

@ApiTags('home-rules')
@ApiBearerAuth('jwt')
@Controller('campaigns/:campaignId/home-rules')
export class CampaignHomeRulesController {
  constructor(private readonly homeRulesService: HomeRulesService) {}

  @Get()
  @UseGuards(CampaignMemberGuard)
  @ApiOperation({ summary: 'List home rules for a campaign' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiQuery({ name: 'status', enum: HomeRuleStatus, required: false })
  @ApiResponse({ status: 200, description: 'Array of home rules' })
  listForCampaign(
    @Param('campaignId') campaignId: string,
    @Query('status') status?: HomeRuleStatus,
  ) {
    return this.homeRulesService.listForCampaign(campaignId, status);
  }

  @Post()
  @UseGuards(CampaignMemberGuard)
  @ApiOperation({ summary: 'Create a home rule for a campaign' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Home rule created' })
  createForCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateHomeRuleDto,
    @CurrentUser() user: RequestUser,
    @Req() req: RequestWithMember,
  ) {
    const defaultStatus =
      user.role === UserRole.ADMIN || req.campaignMember?.role === CampaignRole.GAMEMASTER
        ? HomeRuleStatus.APPROVED
        : HomeRuleStatus.PROPOSED;

    return this.homeRulesService.createForCampaign(campaignId, dto, user, defaultStatus);
  }
}

// ── Standalone routes ───────────────────────────────────────────────────────

@ApiTags('home-rules')
@ApiBearerAuth('jwt')
@Controller('home-rules')
export class HomeRulesController {
  constructor(private readonly homeRulesService: HomeRulesService) {}

  @Get('generic')
  @ApiOperation({ summary: 'List generic (campaign-agnostic) home rules' })
  @ApiQuery({ name: 'status', enum: HomeRuleStatus, required: false })
  @ApiResponse({ status: 200, description: 'Array of generic home rules' })
  listGeneric(@Query('status') status?: HomeRuleStatus) {
    return this.homeRulesService.listGeneric(status);
  }

  @Post('generic')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a generic home rule (Admin only)' })
  @ApiResponse({ status: 201, description: 'Generic home rule created' })
  createGeneric(@Body() dto: CreateHomeRuleDto, @CurrentUser() user: RequestUser) {
    return this.homeRulesService.createGeneric(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a home rule' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Updated home rule' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Home rule not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHomeRuleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.homeRulesService.update(id, dto, user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a home rule (GM or Admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Home rule approved' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.homeRulesService.approve(id, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a home rule (GM or Admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Home rule rejected' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  reject(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.homeRulesService.reject(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a home rule' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Home rule deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.homeRulesService.softDelete(id, user);
  }
}
