import { Request } from 'express';

import { UserRole } from '../users/users.constants';

export const AuthModulePrefix = 'auth-module';

export enum TokenType {
	ACCESS = 'access',
	REFRESH = 'refresh',
	LONG_LIVE = 'long-live',
}

export const AccessTokenType = 'Bearer';

export const DisplaySecretHeader = 'x-display-secret';

export interface AuthenticatedRequest extends Request {
	user?: { id: string | null; role: UserRole };
}

export const DisplaySecretCacheKey = 'display-secret';
