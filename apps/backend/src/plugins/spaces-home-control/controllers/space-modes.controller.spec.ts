import 'reflect-metadata';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ActivityMode } from '../activity/space-activity.constants';

import { SpaceModesController } from './space-modes.controller';

describe('activity controller permissions and authenticated identity', () => {
	it('restricts configuration writes and reset to owner/admin', () => {
		for (const name of ['update', 'reset']) {
			const handler = Reflect.get(SpaceModesController.prototype, name) as object;
			expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		}
	});
	it('uses authenticated actor, returns envelope and refuses ordinary users', async () => {
		const activateMode = jest.fn().mockResolvedValue({ activationId: 'server-activation' });
		const controller = new SpaceModesController({ activateMode } as never, {} as never);
		const body = { data: { expected_revision: 2, actor: 'spoofed', owner_id: 'spoofed' } };
		expect(
			await controller.activate('space', ActivityMode.WORK, body, {
				auth: { type: 'user', id: 'trusted', role: UserRole.ADMIN },
			} as never),
		).toMatchObject({ data: { activationId: 'server-activation' } });
		expect(activateMode).toHaveBeenCalledWith('space', ActivityMode.WORK, 2, 'user:trusted');
		await expect(
			controller.activate('space', ActivityMode.WORK, body, {
				auth: { type: 'user', id: 'ordinary', role: UserRole.USER },
			} as never),
		).rejects.toThrow();
	});
});
