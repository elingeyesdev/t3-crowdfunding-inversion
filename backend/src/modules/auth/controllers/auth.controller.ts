import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService, LoginResponse } from '../services';
import { LoginDto } from '../dto';
import { JwtAuthGuard, GoogleCallbackGuard } from '../guards';
import { GoogleProfile } from '../strategies/google.strategy';
import { ApiSuccessResponse } from '../../../common/dto';
import { User } from '../../users/models';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /auth/login
   * Autentica al usuario y retorna un JWT access token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso. Retorna access_token.',
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<LoginResponse>> {
    const ip = req.ip;
    const result = await this.authService.login(dto, ip);
    return new ApiSuccessResponse(result, 'Login exitoso');
  }

  /**
   * GET /auth/me
   * Retorna el usuario autenticado (requiere token).
   * Alias conveniente de GET /users/me.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar token y obtener usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Token válido. Usuario retornado.' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado.' })
  async me(@Req() req: Request): Promise<ApiSuccessResponse<User>> {
    const user = (req as any).user as User;
    return new ApiSuccessResponse(user, 'Token válido');
  }

  // ── Google OAuth ────────────────────────────────────────────────────────────

  /**
   * GET /auth/google?role=investor|entrepreneur
   * Redirige al flujo de autenticación de Google.
   * El parámetro `role` define el rol asignado si el usuario es nuevo.
   */
  @Get('google')
  @ApiOperation({ summary: 'Iniciar flujo OAuth con Google' })
  @ApiResponse({ status: 302, description: 'Redirige a Google para autenticar.' })
  async googleAuth(
    @Query('role') role: string,
    @Res() res: Response,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL', '');

    const safeRole = role === 'entrepreneur' ? 'entrepreneur' : 'investor';
    const state = Buffer.from(JSON.stringify({ role: safeRole })).toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });

    return res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    );
  }

  /**
   * GET /auth/google/callback
   * Recibe el código de Google, obtiene el perfil y emite el JWT.
   * Redirige al frontend con el token en la URL.
   */
  @Get('google/callback')
  @UseGuards(GoogleCallbackGuard)
  @ApiOperation({ summary: 'Callback OAuth de Google' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const profile = (req as any).user as GoogleProfile;
    const ip = req.ip;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');

    // Extraer rol del state
    let signupRole: 'investor' | 'entrepreneur' = 'investor';
    try {
      const rawState = (req.query?.state as string) ?? '';
      if (rawState) {
        const state = JSON.parse(Buffer.from(rawState, 'base64').toString('utf-8'));
        if (state.role === 'entrepreneur') signupRole = 'entrepreneur';
      }
    } catch {
      // default investor
    }

    try {
      const result = await this.authService.googleOAuthLogin(profile, signupRole, ip);
      const userRole = result.user.roles?.includes('entrepreneur') ? 'entrepreneur' : 'investor';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${result.accessToken}&userId=${result.user.id}&role=${userRole}`;
      return res.redirect(redirectUrl);
    } catch {
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  /**
   * TEMPORAL: Endpoint para crear el primer SuperAdmin y solucionar el problema del hash manual.
   */
  @Get('seed')
  @ApiOperation({ summary: 'Genera el primer super administrador de la plataforma automáticamente.' })
  async seed() {
    const result = await this.authService.seedSuperAdmin();
    return new ApiSuccessResponse(result, 'Seed ejecutado');
  }
}
