import { Controller, Get, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../../auth/guards';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiSuccessResponse } from '../../../common/dto';
import { CreateAdminDto } from '../dto/create-admin.dto';

@ApiTags('superadmin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('superadmin')
export class SuperAdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('admins')
  @ApiOperation({ summary: 'Crear un nuevo usuario Administrador' })
  async createAdmin(@Body() dto: CreateAdminDto) {
    const result = await this.adminService.createAdmin(dto.email, dto.password);
    return new ApiSuccessResponse(result, 'Administrador creado con éxito');
  }

  @Get('admins')
  @ApiOperation({ summary: 'Listar usuarios administradores' })
  async getAllAdmins() {
    const admins = await this.adminService.getAllAdmins();
    return new ApiSuccessResponse(admins, 'Administradores listados');
  }

  @Delete('admins/:id')
  @ApiOperation({ summary: 'Borrar/Revocar permisos de un usuario Administrador' })
  async deleteAdmin(@Param('id') id: string) {
    const result = await this.adminService.deleteAdminProfile(id);
    return new ApiSuccessResponse(result, 'Privilegios de administrador eliminados');
  }
}
