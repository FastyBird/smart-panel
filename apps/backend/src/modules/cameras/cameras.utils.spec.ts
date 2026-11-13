import { TokenOwnerType } from '../auth/auth.constants';
import { UserRole } from '../users/users.constants';

import { CamerasForbiddenException } from './cameras.exceptions';
import { resolveCameraOwner } from './cameras.utils';

describe('resolveCameraOwner', () => {
	it('maps a user', () =>
		expect(resolveCameraOwner({ auth: { type: 'user', id: 'u1', role: UserRole.USER } } as never)).toEqual({
			kind: 'user',
			id: 'u1',
		}));

	it('maps a display token', () =>
		expect(
			resolveCameraOwner({
				auth: { type: 'token', tokenId: 't1', ownerType: TokenOwnerType.DISPLAY, ownerId: 'd1', role: UserRole.USER },
			} as never),
		).toEqual({ kind: 'display', id: 'd1' }));

	it.each([TokenOwnerType.THIRD_PARTY, TokenOwnerType.MCP, TokenOwnerType.USER])(
		'rejects a %s long-lived token',
		(ownerType) =>
			expect(() =>
				resolveCameraOwner({
					auth: { type: 'token', tokenId: 't', ownerType, ownerId: 'x', role: UserRole.USER },
				} as never),
			).toThrow(CamerasForbiddenException),
	);

	it('rejects a display token without an owner and a request without auth', () => {
		expect(() =>
			resolveCameraOwner({
				auth: { type: 'token', tokenId: 't', ownerType: TokenOwnerType.DISPLAY, ownerId: null, role: UserRole.USER },
			} as never),
		).toThrow(CamerasForbiddenException);
		expect(() => resolveCameraOwner({} as never)).toThrow(CamerasForbiddenException);
	});
});
