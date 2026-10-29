import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConflictException, NotFoundException } from '../../../common/exceptions';
import { UserRepository } from '../repositories';
import { CreateUserDto } from '../dto';
import { User } from '../models';
import * as bcrypt from 'bcrypt';

/**
 * Service: Usuarios
 * Logica de negocio para gestion de usuarios.
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepo: UserRepository) {}

  /**
   * Registra un nuevo usuario.
   * Reglas:
   *  - El email debe ser unico.
   *  - El password se hashea con bcrypt (salt 12) en el repository.
   */
  async register(dto: CreateUserDto): Promise<User> {
    this.logger.log(`Registrando usuario: ${dto.email}`);

    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException(
        `El email '${dto.email}' ya esta registrado`,
      );
    }

    const user = await this.userRepo.create(dto);
    this.logger.log(`Usuario creado: ${user.id}`);

    if (dto.signupRole === 'entrepreneur' || dto.signupRole === 'investor') {
      await this.userRepo.assignRoleByName(user.id, dto.signupRole);
      this.logger.log(`Rol asignado: ${dto.signupRole} -> ${user.id}`);
    }

    const withRoles = await this.userRepo.findByIdWithRoles(user.id);
    return withRoles ?? user;
  }

  /**
   * Obtiene un usuario por ID con sus roles.
   * Lanza NotFoundException si no existe.
   */
  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findByIdWithRoles(id);
    if (!user) {
      throw new NotFoundException('Usuario', id);
    }
    return user;
  }

  /**
   * Obtiene el usuario autenticado (alias de findById).
   */
  async getMe(userId: string): Promise<User> {
    return this.findById(userId);
  }

  /**
   * Cambia la contrasena del usuario autenticado.
   * Verifica la contrasena actual antes de actualizar.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    this.logger.log(`Cambio de contrasena solicitado por usuario: ${userId}`);

    const result = await this.userRepo.findByIdWithPassword(userId);
    if (!result) {
      throw new NotFoundException('Usuario', userId);
    }

    if (!result.passwordHash) {
      throw new BadRequestException(
        'Esta cuenta usa autenticacion con Google. No es posible cambiar la contrasena.',
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, result.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('La contrasena actual es incorrecta');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.updatePassword(userId, newHash);
    this.logger.log(`Contrasena actualizada para usuario: ${userId}`);
  }
}
