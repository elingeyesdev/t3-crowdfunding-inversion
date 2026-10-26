import {
  Controller,
  Get,
  Post,
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
import { CreateUserDto } from '../dto';
import { ApiSuccessResponse } from '../../../common/dto';
import { User } from '../models';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * POST /users/register
   * Registra un nuevo usuario. No requiere autenticación.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente.' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
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
