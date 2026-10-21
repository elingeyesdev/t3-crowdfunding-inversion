import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../../users/repositories';
import { User } from '../../users/models';
import { LoginDto } from '../dto';
import { GoogleProfile } from '../strategies/google.strategy';
import {
  UnauthorizedException,
  NotFoundException,
} from '../../../common/exceptions';

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: User;
}

/**
 * Service: Autenticación
 * Gestiona login con validación de password y generación de JWT.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
  ) { }

  /**
   * Valida credenciales y genera un access token JWT.
   * Reglas:
   *  - El usuario debe existir y estar activo.
   *  - El password debe coincidir con el hash almacenado.
   */
  async login(dto: LoginDto, ip?: string): Promise<LoginResponse> {
    this.logger.log(`Intento de login: ${dto.email}`);

    // 1. Buscar usuario con hash
    const result = await this.userRepo.findByEmailWithPassword(dto.email);
    if (!result) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { user, passwordHash } = result;

    // 2. Verificar password
    const isPasswordValid = await bcrypt.compare(dto.password, passwordHash);
    if (!isPasswordValid) {
      await this.userRepo.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Actualizar último login
    await this.userRepo.updateLastLogin(user.id, ip);

    // 4. Usuario con roles + autocorrección si hay perfil pero faltaba fila en user_roles
    let fullUser = await this.userRepo.findByIdWithRoles(user.id);
    if (!fullUser) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!fullUser.roles?.length) {
      if (await this.userRepo.hasEntrepreneurProfile(user.id)) {
        await this.userRepo.assignRoleByName(user.id, 'entrepreneur');
        fullUser = (await this.userRepo.findByIdWithRoles(user.id))!;
        this.logger.log(`Rol entrepreneur restaurado desde perfil: ${user.id}`);
      } else if (await this.userRepo.hasInvestorProfile(user.id)) {
        await this.userRepo.assignRoleByName(user.id, 'investor');
        fullUser = (await this.userRepo.findByIdWithRoles(user.id))!;
        this.logger.log(`Rol investor restaurado desde perfil: ${user.id}`);
      }
    }

    // 5. Generar JWT
    const payload = { sub: fullUser.id, email: fullUser.email };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Login exitoso: ${fullUser.id}`);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
      user: fullUser,
    };
  }

  /**
   * Valida un token JWT y retorna el usuario asociado.
   * Usado internamente por la estrategia Passport.
   */
  async validateToken(userId: string): Promise<User> {
    const user = await this.userRepo.findByIdWithRoles(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Token inválido o usuario inactivo');
    }
    return user;
  }

  /**
   * Autentica (o registra) un usuario via Google OAuth.
   * - Si ya tiene cuenta con ese Google ID → login directo.
   * - Si existe email pero sin OAuth → vincula la cuenta.
   * - Si es nuevo → crea cuenta con el rol especificado.
   */
  async googleOAuthLogin(
    profile: GoogleProfile,
    signupRole: 'investor' | 'entrepreneur',
    ip?: string,
  ): Promise<LoginResponse> {
    this.logger.log(`OAuth Google login: ${profile.email}`);

    const user = await this.userRepo.findOrCreateGoogleUser({
      googleId: profile.googleId,
      email: profile.email,
      picture: profile.picture,
      signupRole,
    });

    await this.userRepo.updateLastLogin(user.id, ip);

    const fullUser = await this.userRepo.findByIdWithRoles(user.id);
    if (!fullUser) {
      throw new UnauthorizedException('Error al autenticar con Google');
    }

    const payload = { sub: fullUser.id, email: fullUser.email };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`OAuth Google login exitoso: ${fullUser.id}`);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
      user: fullUser,
    };
  }

  /**
   * TEMPORAL: Crea el usuario superadmin por defecto.
   */
  async seedSuperAdmin() {
    const passwordHash = await bcrypt.hash('Superadmin123', 12);
    await this.userRepo.seedSuperAdmin(passwordHash);

    return { message: 'SuperAdmin actualizado forzosamente', email: 'superadmin@equipo09.com', password: 'Superadmin123' };
  }
}
