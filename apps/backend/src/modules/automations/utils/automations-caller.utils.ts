import { ForbiddenException } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { AuthenticatedEntity } from '../../auth/guards/auth.guard';
import { UserRole } from '../../users/users.constants';

/** A wall panel, authenticated with its display token */
export function isDisplayCaller(auth: AuthenticatedEntity | undefined): boolean {
	return auth?.type === 'token' && auth.ownerType === TokenOwnerType.DISPLAY && !!auth.ownerId;
}

/**
 * The few automation endpoints a wall panel uses - the list and switching one on or off - admit owners, admins
 * and displays. A display token carries the `user` role, so these routes let that role past the roles guard and
 * this check refuses every `user`-role caller that is not a display: a plain user still cannot read automations.
 */
export function assertOwnerAdminOrDisplay(auth: AuthenticatedEntity | undefined): void {
	if (auth && (auth.role === UserRole.OWNER || auth.role === UserRole.ADMIN)) {
		return;
	}

	if (isDisplayCaller(auth)) {
		return;
	}

	throw new ForbiddenException('Only owners, admins and displays can do this');
}
