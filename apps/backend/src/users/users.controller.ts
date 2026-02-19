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
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import { RequestUser } from '../common/types/request-user.type';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('jwt')
@Controller('users')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List all users',
    description: 'Returns all registered users. Requires ADMIN role.',
  })
  @ApiResponse({ status: 200, description: 'Array of user objects' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'Update a user role',
    description: 'Changes the global role of a user. Requires ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the user', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Updated user object' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently deletes a user account. Requires ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the user to delete', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Post('invites')
  @ApiOperation({
    summary: 'Create an invite',
    description:
      'Generates a single-use invite token for the given email address. Requires ADMIN role.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invite created',
    schema: {
      example: {
        id: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
        email: 'newplayer@example.com',
        token: 'c8e7f2a1-...',
        expiresAt: '2026-02-26T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Active invite already exists for this email' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  createInvite(
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.createInvite(dto.email, user.id);
  }

  @Get('invites')
  @ApiOperation({
    summary: 'List all invites',
    description: 'Returns all invites ordered by creation date. Requires ADMIN role.',
  })
  @ApiResponse({ status: 200, description: 'Array of invite objects' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  findAllInvites() {
    return this.usersService.findAllInvites();
  }

  @Delete('invites/:id')
  @ApiOperation({
    summary: 'Revoke an invite',
    description:
      'Deletes an unused invite. Cannot revoke an already-used invite. Requires ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the invite to revoke', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Invite revoked successfully' })
  @ApiResponse({ status: 400, description: 'Invite has already been used' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  revokeInvite(@Param('id') id: string) {
    return this.usersService.revokeInvite(id);
  }
}
