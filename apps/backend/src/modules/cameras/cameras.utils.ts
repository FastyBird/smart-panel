import { TokenOwnerType } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/guards/auth.guard';

import { CamerasForbiddenException } from './cameras.exceptions';

export interface CameraSessionOwner {
	kind: 'user' | 'display';
	id: string;
}

/** Cameras are available to authenticated users and displays; other long-lived tokens are refused. */
export function resolveCameraOwner(req: AuthenticatedRequest): CameraSessionOwner {
	const auth = req.auth;

	if (auth?.type === 'user') {
		return { kind: 'user', id: auth.id };
	}

	if (auth?.type === 'token' && auth.ownerType === TokenOwnerType.DISPLAY && auth.ownerId) {
		return { kind: 'display', id: auth.ownerId };
	}

	throw new CamerasForbiddenException('Cameras are not available to this caller');
}
