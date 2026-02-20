import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../../generated/prisma';

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    invite: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };
  let configService: { get: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    role: UserRole.PLAYER,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockInvite = {
    id: 'invite-1',
    email: 'invited@example.com',
    token: 'mock-token-uuid',
    createdBy: 'user-1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      invite: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:4200'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return all users without passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith({ select: USER_SELECT });
      expect(result).toEqual([mockUser]);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('createInvite', () => {
    const MOCK_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as `${string}-${string}-${string}-${string}-${string}`;
    const FROZEN_NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

    beforeEach(() => {
      prisma.invite.findFirst.mockResolvedValue(null);
      jest.spyOn(crypto, 'randomUUID').mockReturnValue(MOCK_UUID);
      jest.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
      prisma.invite.create.mockResolvedValue({ ...mockInvite, token: MOCK_UUID });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create invite with 7-day expiry and return invite with link containing the token', async () => {
      const result = await service.createInvite('invited@example.com', 'admin-1');

      expect(prisma.invite.create).toHaveBeenCalledWith({
        data: {
          email: 'invited@example.com',
          token: MOCK_UUID,
          createdBy: 'admin-1',
          expiresAt: new Date(FROZEN_NOW + 7 * 24 * 60 * 60 * 1000),
        },
      });
      expect(result.token).toBe(MOCK_UUID);
      expect(result.link).toContain(`/register?token=${MOCK_UUID}`);
    });

    it('should throw BadRequestException when a pending invite already exists for the email', async () => {
      prisma.invite.findFirst.mockResolvedValue(mockInvite);

      await expect(service.createInvite('invited@example.com', 'admin-1')).rejects.toThrow(
        new BadRequestException('An active invite already exists for this email'),
      );
      expect(prisma.invite.create).not.toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('should call prisma update with the correct params', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });

      const result = await service.updateRole('user-1', UserRole.ADMIN);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.ADMIN },
        select: USER_SELECT,
      });
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateRole('ghost-id', UserRole.ADMIN)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should call prisma delete with the correct params', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(undefined);

      await service.deleteUser('user-1');

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser('ghost-id')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('revokeInvite', () => {
    it('should call prisma delete when invite is unused', async () => {
      prisma.invite.findUnique.mockResolvedValue(mockInvite);
      prisma.invite.delete.mockResolvedValue(undefined);

      await service.revokeInvite('invite-1');

      expect(prisma.invite.delete).toHaveBeenCalledWith({ where: { id: 'invite-1' } });
    });

    it('should throw NotFoundException when invite does not exist', async () => {
      prisma.invite.findUnique.mockResolvedValue(null);

      await expect(service.revokeInvite('ghost-id')).rejects.toThrow(
        new NotFoundException('Invite not found'),
      );
      expect(prisma.invite.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when invite has already been used', async () => {
      prisma.invite.findUnique.mockResolvedValue({ ...mockInvite, usedAt: new Date() });

      await expect(service.revokeInvite('invite-1')).rejects.toThrow(
        new BadRequestException('Invite has already been used'),
      );
      expect(prisma.invite.delete).not.toHaveBeenCalled();
    });
  });
});
