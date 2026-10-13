import { EventEmitter2 } from '@nestjs/event-emitter';

import { CompositeCommandOutcomeModel } from '../../devices/models/composite-command.model';
import { IntentEventType, IntentStatus } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';
import { SceneActionEntity, SceneEntity } from '../entities/scenes.entity';
import { SceneExecutionStatus } from '../scenes.constants';

import { SceneExecutorService } from './scene-executor.service';

const partial: CompositeCommandOutcomeModel = {
	id: 'parent',
	status: 'partial',
	children: [
		{ memberId: 'live', propertyId: 'leaf', status: 'confirmed' },
		{ memberId: 'missing', propertyId: null, status: 'unavailable' },
	],
};

describe('scene correlated composite outcomes', () => {
	it('passes adjacent local actions together and preserves later platform order', async () => {
		const events = new EventEmitter2();
		const intents = new IntentsService(events, { storeIntentCompletion: () => Promise.resolve() } as never);
		const actions = [
			{ id: 'local-1', type: 'local', order: 0 },
			{ id: 'local-2', type: 'local', order: 1 },
			{ id: 'other', type: 'other', order: 2 },
			{ id: 'local-3', type: 'local', order: 3 },
		].map((action) => Object.assign(new SceneActionEntity(), action));
		const scene = Object.assign(new SceneEntity(), { id: 'scene', name: 'Scene', actions });
		const service = new SceneExecutorService(
			{ getOneOrThrow: () => Promise.resolve(scene), updateLastTriggered: () => Promise.resolve() } as never,
			events,
			intents,
		);
		const order: string[][] = [];
		const execute = (_scene: SceneEntity, members: SceneActionEntity[]) => {
			order.push(members.map((member) => member.id));
			return Promise.resolve(
				members.map((member) => ({
					actionId: member.id,
					success: true,
					error: null,
					executionTimeMs: 1,
				})),
			);
		};
		service.registerPlatform({
			getType: () => 'local',
			supportsAdjacentActions: () => true,
			validateAction: () => Promise.resolve(true),
			execute,
		});
		service.registerPlatform({ getType: () => 'other', validateAction: () => Promise.resolve(true), execute });

		const result = await service.triggerScene(scene.id);

		expect(order).toEqual([['local-1', 'local-2'], ['other'], ['local-3']]);
		expect(result.actionResults.map((action) => action.actionId)).toEqual(actions.map((action) => action.id));
	});

	it.each([false, true])('retains confirmed members and runs unrelated actions (unrelated=%s)', async (unrelated) => {
		const events = new EventEmitter2();
		const completed = jest.fn();
		events.on(IntentEventType.COMPLETED, completed);
		const intents = new IntentsService(events, { storeIntentCompletion: () => Promise.resolve() } as never);
		const group = Object.assign(new SceneActionEntity(), {
			id: 'group-action',
			order: 0,
			type: 'test',
			configuration: { device_id: 'group-device' },
		});
		const other = Object.assign(new SceneActionEntity(), {
			id: 'other-action',
			order: 1,
			type: 'test',
			configuration: { device_id: 'other-device' },
		});
		const scene = Object.assign(new SceneEntity(), {
			id: 'scene',
			name: 'Scene',
			actions: unrelated ? [group, other] : [group],
		});
		const service = new SceneExecutorService(
			{ getOneOrThrow: () => Promise.resolve(scene), updateLastTriggered: () => Promise.resolve() } as never,
			events,
			intents,
		);
		const execute = jest.fn((_scene: SceneEntity, actions: SceneActionEntity[]) =>
			Promise.resolve(
				actions.map((action) => ({
					actionId: action.id,
					success: action.id !== group.id,
					error: action.id === group.id ? 'One member unavailable' : null,
					executionTimeMs: 1,
					composite: action.id === group.id ? partial : undefined,
				})),
			),
		);
		service.registerPlatform({ getType: () => 'test', validateAction: () => Promise.resolve(true), execute });
		const result = await service.triggerScene(scene.id);
		expect(result.status).toBe(SceneExecutionStatus.PARTIALLY_COMPLETED);
		expect(result.successfulActions).toBe(unrelated ? 1 : 0);
		expect(result.failedActions).toBe(1);
		expect(result.actionResults[0].composite.children[0].status).toBe('confirmed');
		expect(execute).toHaveBeenCalledTimes(unrelated ? 2 : 1);
		expect(completed).toHaveBeenCalledWith(
			expect.objectContaining({ status: IntentStatus.COMPLETED_PARTIAL, composites: [partial] }),
		);
	});
});
