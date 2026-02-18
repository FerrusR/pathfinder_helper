import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  describe('getHello', () => {
    it('should return "Pathfinder Rule Explorer API"', () => {
      expect(service.getHello()).toBe('Pathfinder Rule Explorer API');
    });
  });
});
