import { TokenOwnerType } from '../../../modules/auth/auth.constants';
import { UserRole } from '../../../modules/users/users.constants';

import { activityActor } from './activity-actor';

describe('space activity manual actor policy', () => {
	it('derives identities from authenticated principals', () => {
		expect(activityActor({ type: 'user', id: 'server-user', role: UserRole.ADMIN })).toBe('user:server-user');
		expect(
			activityActor({
				type: 'token',
				tokenId: 'server-token',
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: 'display-id',
				role: UserRole.USER,
			}),
		).toBe('display:display-id');
	});
	it('rejects absent and ordinary user principals', () => {
		expect(() => activityActor(undefined)).toThrow();
		expect(() => activityActor({ type: 'user', id: 'user', role: UserRole.USER })).toThrow();
	});
});
