import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({ select: USER_SELECT });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async updateRole(userId: string, role: UserRole) {
    await this.findById(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: USER_SELECT,
    });
  }

  async deleteUser(userId: string) {
    await this.findById(userId);
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async createInvite(email: string, createdById: string) {
    const existingInvite = await this.prisma.invite.findFirst({
      where: { email, usedAt: null },
    });
    if (existingInvite) {
      throw new BadRequestException('An active invite already exists for this email');
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: { email, token, createdBy: createdById, expiresAt },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    const link = `${frontendUrl}/register?token=${token}`;

    return { ...invite, link };
  }

  async findAllInvites() {
    return this.prisma.invite.findMany({
      include: {
        creator: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInviteByToken(token: string) {
    return this.prisma.invite.findUnique({ where: { token } });
  }

  async revokeInvite(inviteId: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.usedAt !== null) {
      throw new BadRequestException('Invite has already been used');
    }
    await this.prisma.invite.delete({ where: { id: inviteId } });
  }
}
