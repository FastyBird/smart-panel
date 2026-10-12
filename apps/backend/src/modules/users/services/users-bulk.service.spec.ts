import { Test, TestingModule } from '@nestjs/testing';

import { UserEntity } from '../entities/users.entity';
import { UserRole } from '../users.constants';
import { UsersNotFoundException } from '../users.exceptions';

import { UsersBulkService } from './users-bulk.service';
import { UsersService } from './users.service';

describe('UsersBulkService', () => {
	let service: UsersBulkService;
	let usersService: { getOneOrThrow: jest.Mock; remove: jest.Mock };

	const mockUser = (id: string, role: UserRole = UserRole.USER): UserEntity => ({
		id,
		isHidden: false,
		username: `user-${id}`,
		password: 'hashedpassword',
		email: null,
		firstName: null,
		lastName: null,
		role,
		language: null,
		createdAt: new Date(),
		updatedAt: null,
	});

	beforeEach(async () => {
		usersService = {
			getOneOrThrow: jest.fn().mockImplementation((id: string) => Promise.resolve(mockUser(id))),
			remove: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [UsersBulkService, { provide: UsersService, useValue: usersService }],
		}).compile();

		service = module.get<UsersBulkService>(UsersBulkService);
	});

	describe('remove', () => {
		it('removes every user in the selection', async () => {
			const result = await service.remove(['a', 'b', 'c'], null);

			expect(result.succeeded).toEqual(['a', 'b', 'c']);
			expect(result.failed).toEqual([]);
			expect(usersService.remove).toHaveBeenCalledTimes(3);
		});

		// An account that is not there explains itself, and that explanation is more
		// use to the operator than "failed".
		it('carries the service refusal through as the reason', async () => {
			usersService.getOneOrThrow.mockImplementation((id: string) =>
				id === 'b'
					? Promise.reject(new UsersNotFoundException('Requested user does not exist'))
					: Promise.resolve(mockUser(id)),
			);

			const result = await service.remove(['a', 'b', 'c'], null);

			expect(result.succeeded).toEqual(['a', 'c']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'Requested user does not exist' }]);
		});

		// The single delete endpoint refuses both of these, so the bulk endpoint has
		// to refuse them too - otherwise it is a way around the protection.
		it('refuses to remove the account of the caller', async () => {
			const result = await service.remove(['a', 'b'], 'b');

			expect(result.succeeded).toEqual(['a']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'You cannot delete your own account' }]);
			expect(usersService.remove).toHaveBeenCalledTimes(1);
			expect(usersService.remove).toHaveBeenCalledWith('a');
		});

		it('refuses to remove the owner account', async () => {
			usersService.getOneOrThrow.mockImplementation((id: string) =>
				Promise.resolve(mockUser(id, id === 'b' ? UserRole.OWNER : UserRole.USER)),
			);

			const result = await service.remove(['a', 'b'], null);

			expect(result.succeeded).toEqual(['a']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'The owner account cannot be deleted' }]);
			expect(usersService.remove).toHaveBeenCalledTimes(1);
			expect(usersService.remove).toHaveBeenCalledWith('a');
		});
	});
});
