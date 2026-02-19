import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocalAuthGuard } from '../common/guards';
import { Public } from '../common/decorators';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Authenticates via Passport local strategy. Returns a signed JWT access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: { example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Request() req: { user: { id: string; email: string } }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user via invite token',
    description:
      'Creates a new account. Requires a valid, unused, non-expired invite token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
    schema: { example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired invite token' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
