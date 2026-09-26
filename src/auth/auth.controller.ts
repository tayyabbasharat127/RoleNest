import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SignupDto } from './dto/signup.dto.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgotpass.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiCreatedResponse({ description: 'The user account was created.' })
  @ApiBadRequestResponse({ description: 'The request data is invalid.' })
  @ApiConflictResponse({
    description: 'A user with this email already exists.',
  })
  signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ description: 'Login successful.' })
  @ApiUnauthorizedResponse({ description: 'The email or password is invalid.' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiOkResponse({ description: 'The reset request was accepted.' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset a password using a verification code' })
  @ApiOkResponse({ description: 'The password was reset.' })
  @ApiBadRequestResponse({
    description: 'The password confirmation does not match.',
  })
  @ApiUnauthorizedResponse({
    description: 'The reset code is invalid or expired.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
