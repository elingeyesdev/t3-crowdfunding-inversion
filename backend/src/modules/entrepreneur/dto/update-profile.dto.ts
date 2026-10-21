import { PartialType } from '@nestjs/swagger';
import { CreateEntrepreneurProfileDto } from './create-profile.dto';

/**
 * DTO para actualizar un perfil de emprendedor (EDT 1.2).
 * Todos los campos son opcionales — solo se actualizan los enviados.
 * Hereda las validaciones de CreateEntrepreneurProfileDto.
 */
export class UpdateEntrepreneurProfileDto extends PartialType(
  CreateEntrepreneurProfileDto,
) {}
