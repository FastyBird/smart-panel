import { UserEntity } from '../entities/users.entity';

import {
	UserLifecycleMutationHandler,
	UserLifecycleMutationRegistryService,
} from './user-lifecycle-mutation-registry.service';

describe('UserLifecycleMutationRegistryService', () => {
	let service: UserLifecycleMutationRegistryService;

	beforeEach(() => {
		service = new UserLifecycleMutationRegistryService();
	});

	it('commits directly when no lifecycle handler is registered', async () => {
		const commit = jest.fn().mockResolvedValue('updated');

		await expect(service.update(new UserEntity(), new UserEntity(), commit)).resolves.toBe('updated');
		expect(commit).toHaveBeenCalledWith();
	});

	it('delegates updates and removals to the registered security boundary', async () => {
		const handler = {
			update: jest.fn((_previous, _next, commit) => commit()),
			remove: jest.fn((_user, commit) => commit()),
		} as UserLifecycleMutationHandler;
		const commit = jest.fn().mockResolvedValue('committed');
		service.register(handler);

		await expect(service.update(new UserEntity(), new UserEntity(), commit)).resolves.toBe('committed');
		await expect(service.remove(new UserEntity(), commit)).resolves.toBe('committed');
		expect(handler.update).toHaveBeenCalled();
		expect(handler.remove).toHaveBeenCalled();
	});

	it('rejects competing lifecycle orchestrators', () => {
		const handler = { update: jest.fn(), remove: jest.fn() } as unknown as UserLifecycleMutationHandler;
		service.register(handler);

		expect(() => service.register(handler)).toThrow('already registered');
	});
});
