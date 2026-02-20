import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../../generated/prisma';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    invite: { findUnique: jest.Mock; update: jest.Mock };
  };
  let jwtService: { sign: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    displayName: 'Test User',
    role: UserRole.PLAYER,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockCreatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    role: UserRole.PLAYER,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockInvite = {
    id: 'invite-1',
    email: 'test@example.com',
    token: 'valid-token-uuid',
    createdBy: 'admin-1',
    expiresAt: new Date(Date.now() + 86_400_000), // 1 day from now
    usedAt: null,
    createdAt: new Date('2026-01-01'),
  };

  const mockRegisterDto = {
    email: 'test@example.com',
    password: 'password123',
    displayName: 'Test User',
    inviteToken: 'valid-token-uuid',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      invite: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('should return user without passwordHash when credentials are valid', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: UserRole.PLAYER,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null when email is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('notfound@example.com', 'password123');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrong-password');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return an object with accessToken from JwtService.sign', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };

      const result = await service.login(user);

      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1', email: 'test@example.com' });
      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });
  });

  describe('getInviteByToken', () => {
    it('should return the email when invite is valid', async () => {
      prisma.invite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.getInviteByToken('valid-token-uuid');

      expect(prisma.invite.findUnique).toHaveBeenCalledWith({ where: { token: 'valid-token-uuid' } });
      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should throw NotFoundException when token does not exist', async () => {
      prisma.invite.findUnique.mockResolvedValue(null);

      await expect(service.getInviteByToken('unknown-token')).rejects.toThrow(
        new NotFoundException('Invite not found'),
      );
    });

    it('should throw BadRequestException when invite has already been used', async () => {
      prisma.invite.findUnique.mockResolvedValue({ ...mockInvite, usedAt: new Date() });

      await expect(service.getInviteByToken('valid-token-uuid')).rejects.toThrow(
        new BadRequestException('Invite token has already been used'),
      );
    });

    it('should throw BadRequestException when invite is expired', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        ...mockInvite,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.getInviteByToken('valid-token-uuid')).rejects.toThrow(
        new BadRequestException('Invite token has expired'),
      );
    });
  });

  describe('register', () => {
    beforeEach(() => {
      prisma.invite.findUnique.mockResolvedValue(mockInvite);
      prisma.user.create.mockResolvedValue(mockCreatedUser);
      prisma.invite.update.mockResolvedValue({ ...mockInvite, usedAt: new Date() });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    });

    it('should create user and mark invite as used when invite is valid', async () => {
      const result = await service.register(mockRegisterDto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: mockRegisterDto.email,
          passwordHash: 'hashed-password',
          displayName: mockRegisterDto.displayName,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(prisma.invite.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });

    it('should throw BadRequestException when invite token is invalid', async () => {
      prisma.invite.findUnique.mockResolvedValue(null);

      await expect(service.register(mockRegisterDto)).rejects.toThrow(
        new BadRequestException('Invalid invite token'),
      );
    });

    it('should throw BadRequestException when invite is already used', async () => {
      prisma.invite.findUnique.mockResolvedValue({ ...mockInvite, usedAt: new Date() });

      await expect(service.register(mockRegisterDto)).rejects.toThrow(
        new BadRequestException('Invite token has already been used'),
      );
    });

    it('should throw BadRequestException when invite is expired', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        ...mockInvite,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });

      await expect(service.register(mockRegisterDto)).rejects.toThrow(
        new BadRequestException('Invite token has expired'),
      );
    });

    it('should throw when email is already registered', async () => {
      prisma.user.create.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(service.register(mockRegisterDto)).rejects.toThrow();
    });
  });
});
