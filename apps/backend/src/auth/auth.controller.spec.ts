import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    register: jest.Mock;
    getInviteByToken: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({ accessToken: 'mock-jwt-token' }),
      register: jest.fn().mockResolvedValue({ accessToken: 'mock-jwt-token' }),
      getInviteByToken: jest.fn().mockResolvedValue({ email: 'player@example.com' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should call AuthService.login with the user from the request and return accessToken', async () => {
      const req = { user: { id: 'user-1', email: 'player@example.com' } };

      const result = await controller.login(req);

      expect(authService.login).toHaveBeenCalledWith(req.user);
      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });
  });

  describe('getInvite', () => {
    it('should call AuthService.getInviteByToken with the token param and return email', async () => {
      const result = await controller.getInvite('valid-token-uuid');

      expect(authService.getInviteByToken).toHaveBeenCalledWith('valid-token-uuid');
      expect(result).toEqual({ email: 'player@example.com' });
    });

    it('should propagate errors from AuthService.getInviteByToken', async () => {
      const error = new Error('Invite not found');
      authService.getInviteByToken.mockRejectedValue(error);

      await expect(controller.getInvite('bad-token')).rejects.toThrow('Invite not found');
    });
  });

  describe('register', () => {
    it('should call AuthService.register with the DTO and return accessToken', async () => {
      const dto = {
        email: 'player@example.com',
        password: 'password123',
        displayName: 'New Player',
        inviteToken: 'valid-token-uuid',
      };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });

    it('should propagate errors from AuthService.register', async () => {
      const error = new Error('Invalid invite token');
      authService.register.mockRejectedValue(error);

      await expect(
        controller.register({
          email: 'x@x.com',
          password: 'password123',
          inviteToken: 'bad-token',
        }),
      ).rejects.toThrow('Invalid invite token');
    });
  });
});
