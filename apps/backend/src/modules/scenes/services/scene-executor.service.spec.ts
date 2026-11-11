import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntentsService } from '../../intents/services/intents.service';
import { SceneActionEntity, SceneEntity } from '../entities/scenes.entity';
import { SceneExecutionStatus } from '../scenes.constants';
import { ScenesRunRefusedException } from '../scenes.exceptions';

import { SceneExecutorService, SceneRunGuard } from './scene-executor.service';

const action = (id: string, order: number, enabled = true): SceneActionEntity =>
	Object.assign(new SceneActionEntity(), { id, type: 'local', order, enabled });

describe('SceneExecutorService', () => {
	let scene: SceneEntity | null;
	let events: EventEmitter2;
	let emitted: string[];
	let createIntent: jest.SpyInstance;
	let executed: string[];
	let updateLastTriggered: jest.Mock;
	let service: SceneExecutorService;

	beforeEach(() => {
		scene = Object.assign(new SceneEntity(), {
			id: 'scene',
			name: 'Leaving',
			enabled: true,
			triggerable: true,
			actions: [action('third', 2), action('first', 0), action('disabled', 1, false)],
		});

		events = new EventEmitter2({ wildcard: true });
		emitted = [];
		events.onAny((event) => emitted.push(String(event)));

		const intents = new IntentsService(events, { storeIntentCompletion: () => Promise.resolve() } as never);

		createIntent = jest.spyOn(intents, 'createIntent');
		executed = [];
		updateLastTriggered = jest.fn(() => Promise.resolve());

		service = new SceneExecutorService(
			{
				findOne: () => Promise.resolve(scene),
				getOneOrThrow: () => (scene ? Promise.resolve(scene) : Promise.reject(new Error('not found'))),
				updateLastTriggered,
			} as never,
			events,
			intents,
		);

		service.registerPlatform({
			getType: () => 'local',
			supportsAdjacentActions: () => true,
			validateAction: () => Promise.resolve(true),
			execute: (_scene, members) => {
				executed.push(...members.map((member) => member.id));

				return Promise.resolve(
					members.map((member) => ({ actionId: member.id, success: true, error: null, executionTimeMs: 1 })),
				);
			},
		});
	});

	describe('findEnabledActions', () => {
		it('lists the enabled actions in execution order and changes nothing', async () => {
			const actions = await service.findEnabledActions('scene');

			expect(actions?.map((item) => item.id)).toEqual(['first', 'third']);
			expect(emitted).toEqual([]);
			expect(updateLastTriggered).not.toHaveBeenCalled();
		});

		it('answers null for a scene that does not exist and an empty list for one without actions', async () => {
			if (scene) scene.actions = [];

			expect(await service.findEnabledActions('scene')).toEqual([]);

			scene = null;

			expect(await service.findEnabledActions('scene')).toBeNull();
		});
	});

	describe('triggerScene with a guard', () => {
		it('hands the guard the actions the run is about to execute, in their order', async () => {
			const guard = jest.fn<ReturnType<SceneRunGuard>, Parameters<SceneRunGuard>>(() => null);

			const result = await service.triggerScene('scene', 'automation', undefined, { guard });

			expect(guard).toHaveBeenCalledTimes(1);
			expect(guard.mock.calls[0][0]).toBe(scene);
			expect(guard.mock.calls[0][1].map((item) => item.id)).toEqual(['first', 'third']);
			expect(result.status).toBe(SceneExecutionStatus.COMPLETED);
			expect(executed).toEqual(['first', 'third']);
		});

		it('executes nothing and leaves no trace of a run when the guard refuses', async () => {
			const guard: SceneRunGuard = () => Promise.resolve('The scene was not run: it would unlock a lock.');

			const attempt = service.triggerScene('scene', 'automation', undefined, { guard });

			await expect(attempt).rejects.toBeInstanceOf(ScenesRunRefusedException);
			await expect(attempt).rejects.toThrow('The scene was not run: it would unlock a lock.');

			expect(executed).toEqual([]);
			expect(createIntent).not.toHaveBeenCalled();
			expect(emitted).toEqual([]);
			expect(updateLastTriggered).not.toHaveBeenCalled();
		});

		it('executes nothing when the guard itself fails', async () => {
			const guard: SceneRunGuard = () => Promise.reject(new Error('database is locked'));

			await expect(service.triggerScene('scene', 'automation', undefined, { guard })).rejects.toThrow(
				'database is locked',
			);
			expect(executed).toEqual([]);
			expect(createIntent).not.toHaveBeenCalled();
		});
	});

	it('runs a scene as before when no guard is passed', async () => {
		const result = await service.triggerScene('scene', 'manual');

		expect(result).toMatchObject({ status: SceneExecutionStatus.COMPLETED, triggeredBy: 'manual', failedActions: 0 });
		expect(executed).toEqual(['first', 'third']);
		expect(createIntent).toHaveBeenCalledTimes(1);
		expect(updateLastTriggered).toHaveBeenCalledWith('scene');
	});
});
