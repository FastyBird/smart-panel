import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../users.constants';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles) {
			return true;
		}

		const { user }: { user: { id: string | null; role: UserRole } | undefined } = context.switchToHttp().getRequest();

		return requiredRoles.some((role) => user?.role === role);
	}
}
