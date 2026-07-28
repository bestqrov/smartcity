import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
}

export interface CurrentUserDto {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserDto> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      tenantId: payload.tenantId,
    };
  }
}
