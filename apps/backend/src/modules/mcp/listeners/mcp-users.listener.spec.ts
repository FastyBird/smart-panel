import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { UserEntity } from '../../users/entities/users.entity';
import { EventType, UserRole } from '../../users/users.constants';
import { McpOAuthApproverAuthorityService } from '../services/mcp-oauth-approver-authority.service';

import { McpUsersListener } from './mcp-users.listener';

describe('McpUsersListener', () => {
	const approverAuthority = { invalidateApprover: jest.fn().mockResolvedValue(undefined) };
	const listener = new McpUsersListener(approverAuthority as unknown as McpOAuthApproverAuthorityService);

	beforeEach(() => jest.clearAllMocks());

	it('preserves authority for profile-only updates by an authorized approver', async () => {
		await listener.onUserUpdated(
			Object.assign(new UserEntity(), { id: 'user-id', role: UserRole.ADMIN }),
			UserRole.ADMIN,
		);

		expect(approverAuthority.invalidateApprover).not.toHaveBeenCalled();
	});

	it('awaits invalidation after approver demotion', async () => {
		await listener.onUserUpdated(
			Object.assign(new UserEntity(), { id: 'user-id', role: UserRole.USER }),
			UserRole.ADMIN,
		);

		expect(approverAuthority.invalidateApprover).toHaveBeenCalledWith('user-id');
	});

	it('ignores profile updates by a user who already lacked approver authority', async () => {
		await listener.onUserUpdated(
			Object.assign(new UserEntity(), { id: 'user-id', role: UserRole.USER }),
			UserRole.USER,
		);

		expect(approverAuthority.invalidateApprover).not.toHaveBeenCalled();
	});

	it('awaits invalidation before approver deletion completes', async () => {
		await listener.onUserDeleted(Object.assign(new UserEntity(), { id: 'user-id', role: UserRole.ADMIN }));

		expect(approverAuthority.invalidateApprover).toHaveBeenCalledWith('user-id');
	});

	it('propagates listener failures through emitAsync', async () => {
		const module = await Test.createTestingModule({
			imports: [EventEmitterModule.forRoot()],
			providers: [McpUsersListener, { provide: McpOAuthApproverAuthorityService, useValue: approverAuthority }],
		}).compile();
		await module.init();
		approverAuthority.invalidateApprover.mockRejectedValueOnce(new Error('invalidation failed'));

		await expect(
			module
				.get(EventEmitter2)
				.emitAsync(
					EventType.USER_UPDATED,
					Object.assign(new UserEntity(), { id: 'user-id', role: UserRole.USER }),
					UserRole.ADMIN,
				),
		).rejects.toThrow('invalidation failed');

		await module.close();
	});
});
