import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que protege endpoints con JWT.
 * Uso: @UseGuards(JwtAuthGuard)
 * Extrae y valida automáticamente el token del header Authorization.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
