import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgotpass.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { email, password, first_name, last_name, phone, avatar_url } =
      signupDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        first_name,
        last_name,
        phone,
        avatar_url,
      },
      omit: {
        passwordHash: true,
      },
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      user,
      accessToken,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { user: safeUser, accessToken };
  }

  private hashResetCode(email: string, code: string) {
    return crypto
      .createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${email}:${code}`)
      .digest('hex');
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user)
      return { message: 'If an account exists, a reset code has been sent.' };

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetCodeHash: this.hashResetCode(email, code),
        resetCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const port = Number(this.config.getOrThrow<string>('SMTP_PORT'));
    const transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
    });

    await transporter.sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      to: email,
      subject: 'Reset your password',
      text: `Your password reset code is ${code}. It expires in 10 minutes.`,
    });
    return { message: 'If an account exists, a reset code has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (
      !user?.resetCodeHash ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt <= new Date() ||
      this.hashResetCode(dto.email, dto.code) !== user.resetCodeHash
    ) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        resetCodeHash: user.resetCodeHash,
        resetCodeExpiresAt: { gt: new Date() },
      },
      data: { passwordHash, resetCodeHash: null, resetCodeExpiresAt: null },
    });
    if (updated.count === 0) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }
    return { message: 'Password reset successfully.' };
  }
}
