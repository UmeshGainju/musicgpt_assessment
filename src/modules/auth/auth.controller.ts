import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SwaggerDecorator } from 'src/common/decorators/swagger.decorator';
import { swaggerResponses } from 'src/common/constants/swagger-responses';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @SwaggerDecorator.ApiCreated(swaggerResponses.auth.registered)
  @SwaggerDecorator.ApiConflict('Email already registered')
  @SwaggerDecorator.ApiPreconditionFailed(swaggerResponses.validationFailed)
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return {
      message: 'User registered successfully',
      data,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @SwaggerDecorator.ApiOk(swaggerResponses.auth.loggedIn)
  @SwaggerDecorator.ApiUnauthorized('Invalid credentials')
  @SwaggerDecorator.ApiPreconditionFailed(swaggerResponses.validationFailed)
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return {
      message: 'Login successful',
      data,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using refresh token and session ID',
  })
  @SwaggerDecorator.ApiOk(swaggerResponses.auth.refreshed)
  @SwaggerDecorator.ApiUnauthorized('Invalid or expired refresh token')
  @SwaggerDecorator.ApiPreconditionFailed(swaggerResponses.validationFailed)
  async refresh(@Body() dto: RefreshDto) {
    const data = await this.authService.refresh(dto.refresh_token);
    return {
      message: 'Token refreshed successfully',
      data,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout - revoke all refresh tokens and destroy session',
  })
  @SwaggerDecorator.ApiOk(swaggerResponses.auth.loggedOut)
  @SwaggerDecorator.ApiUnauthorized()
  async logout(@CurrentUser() user: { id: string }) {
    await this.authService.logout(user.id);
    return { message: 'Logged out successfully' };
  }
}
