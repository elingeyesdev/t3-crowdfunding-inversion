import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { User } from '../../users/models';
import { UserRepository } from '../../users/repositories';

export interface JwtPayload {
  sub: string;    // userId
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Estrategia JWT para Passport.
 * Extrae el token del header Authorization: Bearer <token>.
 * Valida firma y expiración automáticamente.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userRepo: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change-me-in-production'),
    });
  }

  /**
   * Llamado después de validar el token.
   * Lo que retorne este método se asigna a req.user.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepo.findByIdWithRoles(payload.sub);
    if (!user || !user.isActive) {
      throw new Error('Usuario inválido o inactivo');
    }
    return user;
  }
}
