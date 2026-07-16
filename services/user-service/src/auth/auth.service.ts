import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.jwtRefreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  async register(dto: RegisterDto) {
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        tenantId: dto.tenantId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token in Redis (7 days)
    await this.redis.set(`rt:${user.id}:${refreshToken}`, refreshToken, 7 * 24 * 60 * 60);

    this.logger.log(`User registered: ${user.email}`);

    return { accessToken, refreshToken, user };
  }

  async login(dto: LoginDto) {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
    };

    // Generate tokens
    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token in Redis (7 days)
    await this.redis.set(`rt:${user.id}:${refreshToken}`, refreshToken, 7 * 24 * 60 * 60);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken,
      refreshToken,
      user: userPayload,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as {
        userId: string;
      };

      // Verify refresh token exists in Redis
      const stored = await this.redis.get(`rt:${payload.userId}:${refreshToken}`);
      if (!stored) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          tenantId: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Rotate tokens: delete old, create new
      await this.redis.del(`rt:${payload.userId}:${refreshToken}`);

      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user.id);

      await this.redis.set(
        `rt:${user.id}:${newRefreshToken}`,
        newRefreshToken,
        7 * 24 * 60 * 60,
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as {
        userId: string;
      };

      // Remove refresh token from Redis
      await this.redis.del(`rt:${payload.userId}:${refreshToken}`);

      // Blacklist the access token (15 min TTL matching access token expiry)
      // Note: The access token itself isn't passed here; the client should discard it
      this.logger.log(`User logged out: ${payload.userId}`);

      return { message: 'Logged out successfully' };
    } catch {
      // Even if token is invalid, return success (idempotent logout)
      return { message: 'Logged out successfully' };
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store in Redis with 1 hour TTL
    await this.redis.set(`pwd-reset:${resetToken}`, user.id, 3600);

    // TODO: Send email with reset link
    this.logger.log(`Password reset requested for: ${email}, token: ${resetToken}`);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    // Verify reset token
    const userId = await this.redis.get(`pwd-reset:${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    // Delete reset token
    await this.redis.del(`pwd-reset:${token}`);

    this.logger.log(`Password reset completed for user: ${userId}`);

    return { message: 'Password reset successfully' };
  }

  private generateAccessToken(user: Record<string, any>): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      this.jwtSecret,
      { expiresIn: '15m' },
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.jwtRefreshSecret,
      { expiresIn: '7d' },
    );
  }
}
