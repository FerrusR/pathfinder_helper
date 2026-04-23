import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequireCampaignRole } from '../common/decorators';
import { CampaignMemberGuard } from '../common/guards';
import { RequestUser } from '../common/types/request-user.type';
import { CampaignsService } from './campaigns.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@ApiTags('campaigns')
@ApiBearerAuth('jwt')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns for the current user' })
  @ApiResponse({ status: 200, description: 'Array of campaign objects' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.campaignsService.findAllForUser(user);
  }

  @Get(':id')
  @UseGuards(CampaignMemberGuard)
  @ApiOperation({ summary: 'Get a single campaign by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Campaign object' })
  @ApiResponse({ status: 403, description: 'Not a member of this campaign' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.campaignsService.findById(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a campaign; creator becomes Gamemaster' })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.campaignsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(CampaignMemberGuard)
  @RequireCampaignRole('GAMEMASTER')
  @ApiOperation({ summary: 'Update campaign (Gamemaster or Admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Updated campaign' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.campaignsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(CampaignMemberGuard)
  @RequireCampaignRole('GAMEMASTER')
  @ApiOperation({ summary: 'Soft-delete a campaign (Gamemaster or Admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Campaign soft-deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.campaignsService.softDelete(id, user);
  }

  // ── Membership endpoints ──────────────────────────────────────────────────

  @Get(':id/members')
  @UseGuards(CampaignMemberGuard)
  @ApiOperation({ summary: 'List active members of a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Array of member objects with user info' })
  @ApiResponse({ status: 403, description: 'Not a member of this campaign' })
  listMembers(@Param('id') id: string) {
    return this.campaignsService.listMembers(id);
  }

  @Post(':id/members')
  @UseGuards(CampaignMemberGuard)
  @RequireCampaignRole('GAMEMASTER')
  @ApiOperation({ summary: 'Add a member to a campaign (Gamemaster or Admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign UUID', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Member added' })
  @ApiResponse({ status: 409, description: 'User is already an active member' })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.campaignsService.addMember(id, dto);
  }

  @Patch(':id/members/:userId')
  @UseGuards(CampaignMemberGuard)
  @RequireCampaignRole('GAMEMASTER')
  @ApiOperation({ summary: 'Update a member role (Gamemaster or Admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign UUID', format: 'uuid' })
  @ApiParam({ name: 'userId', description: 'User UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Member role updated' })
  @ApiResponse({ status: 400, description: 'Cannot remove the last Gamemaster' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.campaignsService.updateMemberRole(id, userId, dto);
  }

  @Delete(':id/members/:userId')
  @UseGuards(CampaignMemberGuard)
  @RequireCampaignRole('GAMEMASTER')
  @ApiOperation({ summary: 'Remove a member from a campaign (Gamemaster or Admin only)' })
  @ApiParam({ name: 'id', description: 'Campaign UUID', format: 'uuid' })
  @ApiParam({ name: 'userId', description: 'User UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Member soft-deleted' })
  @ApiResponse({ status: 400, description: 'Cannot remove the last Gamemaster' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.campaignsService.removeMember(id, userId);
  }
}
