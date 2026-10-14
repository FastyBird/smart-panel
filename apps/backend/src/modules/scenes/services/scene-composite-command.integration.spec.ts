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
			expect.objectContaining({
				status: IntentStatus.COMPLETED_PARTIAL,
				composites: [
					{
						id: 'parent',
						status: 'partial',
						children: [
							{ member_id: 'live', property_id: 'leaf', status: 'confirmed' },
							{ member_id: 'missing', property_id: null, status: 'unavailable' },
						],
					},
				],
			}),
		);
	});
});
