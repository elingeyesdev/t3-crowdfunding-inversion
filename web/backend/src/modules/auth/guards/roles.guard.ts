import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { User } from '../../users/models';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      return false;
    }

    // Check user.roles array (investor, entrepreneur, etc.)
    const userRoles = user.roles ?? [];
    const hasUserRole = requiredRoles.some((role) => userRoles.includes(role));

    // Check adminAccessLevel (admin, super_admin)
    const hasAdminRole = user.adminAccessLevel
      ? requiredRoles.includes(user.adminAccessLevel)
      : false;

    if (!hasUserRole && !hasAdminRole) {
      throw new ForbiddenException('No tienes permisos suficientes para realizar esta acción.');
    }

    return true;
  }
}

