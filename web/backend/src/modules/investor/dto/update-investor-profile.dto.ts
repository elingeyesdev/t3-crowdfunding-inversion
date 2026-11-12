import { PartialType } from '@nestjs/swagger';
import { CreateInvestorProfileDto } from './create-investor-profile.dto';

/**
 * DTO para actualizar un perfil de inversor.
 * Todos los campos son opcionales — solo se actualizan los enviados.
 * Hereda las validaciones de CreateInvestorProfileDto.
 */
export class UpdateInvestorProfileDto extends PartialType(
  CreateInvestorProfileDto,
) {}
