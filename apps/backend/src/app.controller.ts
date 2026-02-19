import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  @ApiResponse({ status: 200, description: 'OK', schema: { example: 'Hello World!' } })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns service status and current timestamp. No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: { example: { status: 'ok', timestamp: '2026-02-19T10:00:00.000Z' } },
  })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
