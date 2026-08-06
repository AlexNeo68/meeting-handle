import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveJwtSecret } from '../../common/utils/jwt-secret.util';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email?: string;
  tokenVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true },
    });

    // A token is only valid while its tokenVersion matches the current one.
    // Bumping tokenVersion (e.g. on password change) invalidates every JWT
    // issued before the change.
    if (!user || payload.tokenVersion === undefined || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Invalid token');
    }

    return { sub: payload.sub, email: payload.email };
  }
}
