import { ForbiddenException } from '@nestjs/common';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { CamerasForbiddenException } from '../cameras.exceptions';
import { CameraSessionOwner, resolveCameraOwner } from '../cameras.utils';

/** Resolves the caller as a camera owner; a caller without access gets a 403. */
export function requireCameraOwner(req: AuthenticatedRequest): CameraSessionOwner {
	try {
		return resolveCameraOwner(req);
	} catch (error) {
		if (error instanceof CamerasForbiddenException) {
			throw new ForbiddenException(error.message);
		}

		throw error;
	}
}
