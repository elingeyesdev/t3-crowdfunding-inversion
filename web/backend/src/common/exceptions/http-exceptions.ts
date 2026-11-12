import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 404 — Recurso no encontrado.
 */
export class NotFoundException extends HttpException {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} con id '${identifier}' no encontrado`
      : `${resource} no encontrado`;
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * 409 — Recurso ya existe.
 */
export class ConflictException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * 403 — No tiene permiso.
 */
export class ForbiddenException extends HttpException {
  constructor(message: string = 'No tienes permiso para realizar esta acción') {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * 400 — Datos inválidos (negocio).
 */
export class BadRequestException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 401 — No autenticado / token inválido.
 */
export class UnauthorizedException extends HttpException {
  constructor(message: string = 'No autenticado o token inválido') {
    super(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'Unauthorized',
        message,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
