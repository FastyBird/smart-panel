import { DataSource, EntityManager } from 'typeorm';

import { UserEntity } from '../entities/users.entity';

import {
	UserLifecycleMutationHandler,
	UserLifecycleMutationParticipant,
	UserLifecycleMutationRegistryService,
} from './user-lifecycle-mutation-registry.service';

describe('UserLifecycleMutationRegistryService', () => {
	let service: UserLifecycleMutationRegistryService;
	let transactionManager: EntityManager;

	beforeEach(() => {
		transactionManager = {} as EntityManager;
		service = new UserLifecycleMutationRegistryService({
			transaction: <T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> => operation(transactionManager),
		} as unknown as DataSource);
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

	it('runs additive participants and the user commit in one transaction', async () => {
		const previous = new UserEntity();
		const next = new UserEntity();
		const participant = {
			prepareUpdate: jest.fn().mockResolvedValue(undefined),
			prepareRemove: jest.fn().mockResolvedValue(undefined),
		} as UserLifecycleMutationParticipant;
		const commit = jest.fn().mockResolvedValue('committed');
		service.registerParticipant(participant);

		await expect(service.update(previous, next, commit)).resolves.toBe('committed');
		expect(participant.prepareUpdate).toHaveBeenCalledWith(previous, next, transactionManager);
		expect(commit).toHaveBeenCalledWith(transactionManager);
	});

	it('joins the transaction supplied by the primary security orchestrator', async () => {
		const previous = new UserEntity();
		const next = new UserEntity();
		const participant = {
			prepareUpdate: jest.fn().mockResolvedValue(undefined),
			prepareRemove: jest.fn().mockResolvedValue(undefined),
		} as UserLifecycleMutationParticipant;
		const handler = {
			update: jest.fn((_previous, _next, commit) => commit(transactionManager)),
			remove: jest.fn((_user, commit) => commit(transactionManager)),
		} as UserLifecycleMutationHandler;
		const commit = jest.fn().mockResolvedValue('committed');
		service.register(handler);
		service.registerParticipant(participant);

		await expect(service.update(previous, next, commit)).resolves.toBe('committed');
		expect(participant.prepareUpdate).toHaveBeenCalledWith(previous, next, transactionManager);
		expect(commit).toHaveBeenCalledWith(transactionManager);
	});

	it('rejects duplicate additive participants', () => {
		const participant = {
			prepareUpdate: jest.fn(),
			prepareRemove: jest.fn(),
		} as unknown as UserLifecycleMutationParticipant;
		service.registerParticipant(participant);

		expect(() => service.registerParticipant(participant)).toThrow('already registered');
	});
});
