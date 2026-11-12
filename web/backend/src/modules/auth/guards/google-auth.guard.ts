import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para el callback de Google OAuth (/auth/google/callback).
 * Usa Passport para intercambiar el código por un token y obtener el perfil.
 * session: false evita errores por falta de express-session.
 */
@Injectable()
export class GoogleCallbackGuard extends AuthGuard('google') {
  getAuthenticateOptions() {
    return { session: false };
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Google OAuth falló');
    }
    return user;
  }
}
