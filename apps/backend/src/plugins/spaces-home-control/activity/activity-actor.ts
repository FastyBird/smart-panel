import { ForbiddenException } from '@nestjs/common';

import { TokenOwnerType } from '../../../modules/auth/auth.constants';
import { AuthenticatedEntity } from '../../../modules/auth/guards/auth.guard';
import { UserRole } from '../../../modules/users/users.constants';

/** Same manual-control policy as existing space WS intents: displays or owner/admin users. */
export function activityActor(auth: AuthenticatedEntity | undefined): string {
	if (auth?.type === 'token' && auth.ownerType === TokenOwnerType.DISPLAY)
		return `display:${auth.ownerId ?? auth.tokenId}`;
	if (auth?.type === 'user' && [UserRole.OWNER, UserRole.ADMIN].includes(auth.role)) return `user:${auth.id}`;
	throw new ForbiddenException('Space activity control requires a display or owner/admin user');
}
