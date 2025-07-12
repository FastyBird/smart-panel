import { FastifyRequest as Request } from 'fastify';

import { UserRole } from '../users/users.constants';

export const AUTH_MODULE_PREFIX = 'auth-module';

export const AUTH_MODULE_NAME = 'auth-module';

export enum TokenType {
	ACCESS = 'access',
	REFRESH = 'refresh',
	LONG_LIVE = 'long-live',
}

export const ACCESS_TOKEN_TYPE = 'Bearer';

export const DISPLAY_SECRET_HEADER = 'x-display-secret';

export const DISPLAY_SECRET_CACHE_KEY = 'display-secret';

export interface AuthenticatedRequest extends Request {
	user?: { id: string | null; role: UserRole };
}
