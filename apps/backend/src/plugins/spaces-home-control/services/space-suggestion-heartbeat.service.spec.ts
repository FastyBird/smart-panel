import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';

import { SpacesService } from '../../../modules/spaces/services/spaces.service';

import {
	SUGGESTION_HEARTBEAT_MAX_CYCLE_MS,
	SpaceSuggestionHeartbeatService,
} from './space-suggestion-heartbeat.service';
import { SpaceSuggestionService } from './space-suggestion.service';

jest.mock('../../../modules/spaces/services/spaces.service', () => ({ SpacesService: class SpacesService {} }));
jest.mock('./space-suggestion.service', () => ({ SpaceSuggestionService: class SpaceSuggestionService {} }));

describe('SpaceSuggestionHeartbeatService', () => {
	let service: SpaceSuggestionHeartbeatService;
	let schedulerRegistry: {
		addInterval: jest.Mock;
		deleteInterval: jest.Mock;
		getInterval: jest.Mock;
	};
	let findAll: jest.Mock;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	beforeEach(() => {
		schedulerRegistry = {
			addInterval: jest.fn((_name: string, id: ReturnType<typeof setInterval>) => {
				intervalId = id;
			}),
			deleteInterval: jest.fn(() => {
				if (intervalId) {
					clearInterval(intervalId);
					intervalId = null;
				}
			}),
			getInterval: jest.fn(() => intervalId),
		};
		findAll = jest.fn().mockResolvedValue([]);

		service = new SpaceSuggestionHeartbeatService(
			schedulerRegistry as unknown as SchedulerRegistry,
			{ findAll } as unknown as SpacesService,
			{ getSuggestion: jest.fn() } as unknown as SpaceSuggestionService,
			{ emit: jest.fn() } as unknown as EventEmitter2,
		);
	});

	afterEach(() => {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	});

	it('identifies itself as an owner-enabled plugin service', () => {
		expect(service.owner).toEqual({ kind: 'plugin', type: 'spaces-home-control-plugin' });
		expect(service.serviceId).toBe('suggestion-heartbeat');
	});

	it('starts and stops its scheduler interval idempotently', async () => {
		await service.start();
		await service.start();

		expect(schedulerRegistry.addInterval).toHaveBeenCalledTimes(1);
		expect(service.getState()).toBe('started');

		await service.stop();
		await service.stop();

		expect(schedulerRegistry.deleteInterval).toHaveBeenCalledTimes(2);
		expect(service.getState()).toBe('stopped');
	});

	it('reports a stopped heartbeat as unhealthy', async () => {
		await expect(service.isHealthy()).resolves.toBe(false);
	});

	it('reports an active ordinary cycle as healthy', async () => {
		await service.start();

		let resolveSpaces: ((spaces: []) => void) | undefined;
		findAll.mockReturnValue(
			new Promise<[]>((resolve) => {
				resolveSpaces = resolve;
			}),
		);
		const cycle = service.runCycle();

		await Promise.resolve();
		expect(await service.isHealthy()).toBe(true);

		resolveSpaces?.([]);
		await cycle;
	});

	it('reports a wedged cycle as unhealthy and clears its running timestamp when it finishes', async () => {
		const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
		await service.start();

		let resolveSpaces: ((spaces: []) => void) | undefined;
		findAll.mockReturnValue(
			new Promise<[]>((resolve) => {
				resolveSpaces = resolve;
			}),
		);
		const cycle = service.runCycle();

		await Promise.resolve();
		now.mockReturnValue(1_000 + SUGGESTION_HEARTBEAT_MAX_CYCLE_MS + 1);
		expect(await service.isHealthy()).toBe(false);

		resolveSpaces?.([]);
		await cycle;
		expect(await service.isHealthy()).toBe(true);
		now.mockRestore();
	});

	it('reports a missing scheduled interval as unhealthy', async () => {
		await service.start();
		schedulerRegistry.getInterval.mockImplementation(() => {
			throw new Error('Interval not found');
		});

		expect(await service.isHealthy()).toBe(false);
	});
});
