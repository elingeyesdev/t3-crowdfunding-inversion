import { Injectable, Logger } from '@nestjs/common';
import { ConflictException, NotFoundException } from '../../../common/exceptions';
import { UserRepository } from '../repositories';
import { CreateUserDto } from '../dto';
import { User } from '../models';

/**
 * Service: Usuarios
 * Lógica de negocio para gestión de usuarios.
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepo: UserRepository) {}

  /**
   * Registra un nuevo usuario.
   * Reglas:
   *  - El email debe ser único.
   *  - El password se hashea con bcrypt (salt 12) en el repository.
   */
  async register(dto: CreateUserDto): Promise<User> {
    this.logger.log(`Registrando usuario: ${dto.email}`);

    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException(
        `El email '${dto.email}' ya está registrado`,
      );
    }

    const user = await this.userRepo.create(dto);
    this.logger.log(`Usuario creado: ${user.id}`);

    if (dto.signupRole === 'entrepreneur' || dto.signupRole === 'investor') {
      await this.userRepo.assignRoleByName(user.id, dto.signupRole);
      this.logger.log(`Rol asignado: ${dto.signupRole} → ${user.id}`);
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
}
