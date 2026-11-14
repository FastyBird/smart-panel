import { ForbiddenException } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { AuthenticatedEntity } from '../../auth/guards/auth.guard';
import { UserRole } from '../../users/users.constants';

import { assertOwnerAdminOrDisplay, isDisplayCaller } from './automations-caller.utils';

describe('automations caller utils', () => {
	const display: AuthenticatedEntity = {
		type: 'token',
		tokenId: 'token-1',
		ownerType: TokenOwnerType.DISPLAY,
		ownerId: 'display-1',
		role: UserRole.USER,
	};

	it.each([UserRole.OWNER, UserRole.ADMIN])('admits a %s user', (role) => {
		expect(() => assertOwnerAdminOrDisplay({ type: 'user', id: 'u', role })).not.toThrow();
	});

	it('admits a display token', () => {
		expect(isDisplayCaller(display)).toBe(true);
		expect(() => assertOwnerAdminOrDisplay(display)).not.toThrow();
	});

	it.each<[string, AuthenticatedEntity | undefined]>([
		['nobody', undefined],
		['a plain user', { type: 'user', id: 'u', role: UserRole.USER }],
		[
			'a user API token of a plain user',
			{ type: 'token', tokenId: 't', ownerType: TokenOwnerType.USER, ownerId: 'u', role: UserRole.USER },
		],
		['a display token without its display', { ...display, ownerId: null }],
	])('refuses %s', (_label, auth) => {
		expect(() => assertOwnerAdminOrDisplay(auth)).toThrow(ForbiddenException);
	});
});
