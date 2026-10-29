import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { UserService } from '../services';
import { CreateUserDto, ChangePasswordDto } from '../dto';
import { ApiSuccessResponse } from '../../../common/dto';
import { User } from '../models';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * POST /users/register
   * Registra un nuevo usuario. No requiere autenticacion.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente.' })
  @ApiResponse({ status: 409, description: 'El email ya esta registrado.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada invalidos.' })
  async register(
    @Body() dto: CreateUserDto,
  ): Promise<ApiSuccessResponse<User>> {
    const user = await this.userService.register(dto);
    return new ApiSuccessResponse(user, 'Usuario registrado exitosamente');
  }

  /**
   * GET /users/me
   * Retorna el usuario autenticado (requiere token JWT).
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mi usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Usuario retornado exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async getMe(@Req() req: Request): Promise<ApiSuccessResponse<User>> {
    const userId = (req as any).user.id;
    const user = await this.userService.getMe(userId);
    return new ApiSuccessResponse(user);
  }

  /**
   * PATCH /users/me/password
   * Cambia la contrasena del usuario autenticado (requiere JWT).
   */
  @Patch('me/password')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contrasena del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Contrasena actualizada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Contrasena actual incorrecta o cuenta OAuth.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiSuccessResponse<null>> {
    const userId = (req as any).user.id;
    await this.userService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return new ApiSuccessResponse(null, 'Contrasena actualizada exitosamente');
  }

  /**
   * GET /users/:id
   * Retorna un usuario por ID (requiere token JWT).
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiResponse({ status: 200, description: 'Usuario retornado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async findById(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<User>> {
    const user = await this.userService.findById(id);
    return new ApiSuccessResponse(user);
  }
}
