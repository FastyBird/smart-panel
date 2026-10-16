import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ForbiddenException } from '@nestjs/common';

import { UserRole } from '../../../modules/users/users.constants';
import { COVER_RECOVERY_ACKNOWLEDGEMENT, RecoverCoverOrderingDto } from '../dto/cover-recovery.dto';

import { ShellyCoverRecoveryController } from './shelly-cover-recovery.controller';

describe('ordinary cover operator recovery authorization and explicit acknowledgement', () => {
	const recovery = { context: jest.fn(), recover: jest.fn() };
	const controller = new ShellyCoverRecoveryController(recovery as never);
	beforeEach(() => jest.clearAllMocks());
	it.each([
		undefined,
		{ type: 'user', id: 'user', role: UserRole.USER },
		{ type: 'token', ownerType: 'display', role: UserRole.OWNER },
		{ type: 'token', ownerType: 'user', role: UserRole.ADMIN },
		{ type: 'user', id: '', role: UserRole.OWNER },
	])('returns 403 for an unauthorized principal %j before context, metadata or provider work', async (auth) => {
		const request = { auth } as never;
		for (const operation of [
			controller.context(request, 'device', 'channel', 'property'),
			controller.recover(request, 'device', 'channel', 'property', { data: {} } as never),
		])
			await expect(operation).rejects.toBeInstanceOf(ForbiddenException);
		expect(recovery.context).not.toHaveBeenCalled();
		expect(recovery.recover).not.toHaveBeenCalled();
	});
	it.each([UserRole.OWNER, UserRole.ADMIN])(
		'uses the identified %s actor, never caller-supplied audit authority',
		async (role) => {
			recovery.context.mockResolvedValue({ context_id: 'server-context' });
			recovery.recover.mockResolvedValue({ advisory: 'operator_overridden_unresolved_ordering' });
			const request = { auth: { type: 'user', id: 'identified-actor', role } } as never;
			await controller.context(request, 'device', 'channel', 'property');
			await controller.recover(request, 'device', 'channel', 'property', {
				data: { reason: 'Operator inspected installation' },
			} as never);
			expect(recovery.context).toHaveBeenCalledWith('identified-actor', 'device', 'channel', 'property');
			expect(recovery.recover).toHaveBeenCalledWith('identified-actor', 'device', 'channel', 'property', {
				reason: 'Operator inspected installation',
			});
		},
	);
	it.each([
		{ acknowledgement: true },
		{ acknowledgement: 'recover' },
		{ reason: '' },
		{ reason: '   ' },
		{ reason: 'x'.repeat(501) },
		{ expected_token: 'not-a-token' },
		{ expected_revision: 'stale' },
	])('rejects missing literal acceptance, malformed context and unbounded reasons: %j', async (change) => {
		const dto = plainToInstance(RecoverCoverOrderingDto, {
			context_id: '00000000-0000-4000-8000-000000000001',
			expected_token: '00000000-0000-4000-8000-000000000002',
			expected_revision: 'a'.repeat(64),
			acknowledgement: COVER_RECOVERY_ACKNOWLEDGEMENT,
			reason: 'Operator accepts handback',
			...change,
		});
		expect((await validate(dto)).length).toBeGreaterThan(0);
	});
});
