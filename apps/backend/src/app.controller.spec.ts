import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
    appService = module.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return the value from AppService', () => {
      expect(controller.getHello()).toBe('Pathfinder Rule Explorer API');
    });

    it('should delegate to AppService.getHello', () => {
      const spy = jest.spyOn(appService, 'getHello').mockReturnValue('test');
      expect(controller.getHello()).toBe('test');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck', () => {
    it('should return status ok with a timestamp', () => {
      const result = controller.healthCheck();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });
});
