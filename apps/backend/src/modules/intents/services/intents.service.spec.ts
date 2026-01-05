import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import {
	DEFAULT_TTL_DEVICE_COMMAND,
	IntentEventType,
	IntentStatus,
	IntentTargetStatus,
	IntentType,
} from '../intents.constants';

import { IntentsService } from './intents.service';

describe('IntentsService', () => {
	let service: IntentsService;
	let eventEmitter: EventEmitter2;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				IntentsService,
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<IntentsService>(IntentsService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);

		// Initialize the service (starts cleanup interval)
		service.onModuleInit();
	});

	afterEach(() => {
		// Clean up the service (stops cleanup interval)
		service.onModuleDestroy();
	});

	describe('createIntent', () => {
		it('should create an intent with default TTL', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1', channelId: 'channel-1', propertyId: 'property-1' }],
				value: 50,
			});

			expect(intent).toBeDefined();
			expect(intent.id).toBeDefined();
			expect(intent.type).toBe(IntentType.LIGHT_SET_BRIGHTNESS);
			expect(intent.status).toBe(IntentStatus.PENDING);
			expect(intent.ttlMs).toBe(DEFAULT_TTL_DEVICE_COMMAND);
			expect(intent.targets).toHaveLength(1);
			expect(intent.value).toBe(50);
		});

		it('should create an intent with custom TTL', () => {
			const intent = service.createIntent({
				type: IntentType.SCENE_RUN,
				targets: [{ deviceId: 'device-1' }],
				value: { sceneName: 'Test Scene' },
				ttlMs: 5000,
			});

			expect(intent.ttlMs).toBe(5000);
		});

		it('should emit intent.created event', () => {
			const emitSpy = jest.spyOn(eventEmitter, 'emit');

			service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
			});

			expect(emitSpy).toHaveBeenCalledWith(
				IntentEventType.CREATED,
				expect.objectContaining({
					type: IntentType.LIGHT_TOGGLE,
					status: IntentStatus.PENDING,
				}),
			);
		});

		it('should set correct expiration time', () => {
			const beforeCreate = Date.now();

			const intent = service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1' }],
				value: 75,
				ttlMs: 3000,
			});

			const afterCreate = Date.now();

			expect(intent.expiresAt.getTime()).toBeGreaterThanOrEqual(beforeCreate + 3000);
			expect(intent.expiresAt.getTime()).toBeLessThanOrEqual(afterCreate + 3000);
		});

		it('should store intent with scope', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1' }],
				value: 50,
				scope: { roomId: 'room-1', roleId: 'role-1' },
			});

			expect(intent.scope?.roomId).toBe('room-1');
			expect(intent.scope?.roleId).toBe('role-1');
		});
	});

	describe('completeIntent', () => {
		it('should complete intent with success status when all targets succeed', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1' }, { deviceId: 'device-2' }],
				value: 50,
			});

			const completed = service.completeIntent(intent.id, [
				{ deviceId: 'device-1', status: IntentTargetStatus.SUCCESS },
				{ deviceId: 'device-2', status: IntentTargetStatus.SUCCESS },
			]);

			expect(completed?.status).toBe(IntentStatus.COMPLETED_SUCCESS);
			expect(completed?.results).toHaveLength(2);
			expect(completed?.completedAt).toBeDefined();
		});

		it('should complete intent with partial status when some targets fail', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1' }, { deviceId: 'device-2' }],
				value: 50,
			});

			const completed = service.completeIntent(intent.id, [
				{ deviceId: 'device-1', status: IntentTargetStatus.SUCCESS },
				{ deviceId: 'device-2', status: IntentTargetStatus.FAILED, error: 'Connection timeout' },
			]);

			expect(completed?.status).toBe(IntentStatus.COMPLETED_PARTIAL);
		});

		it('should complete intent with failed status when all targets fail', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1' }, { deviceId: 'device-2' }],
				value: 50,
			});

			const completed = service.completeIntent(intent.id, [
				{ deviceId: 'device-1', status: IntentTargetStatus.FAILED },
				{ deviceId: 'device-2', status: IntentTargetStatus.TIMEOUT },
			]);

			expect(completed?.status).toBe(IntentStatus.COMPLETED_FAILED);
		});

		it('should emit intent.completed event', () => {
			const emitSpy = jest.spyOn(eventEmitter, 'emit');

			const intent = service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
			});

			service.completeIntent(intent.id, [{ deviceId: 'device-1', status: IntentTargetStatus.SUCCESS }]);

			expect(emitSpy).toHaveBeenCalledWith(
				IntentEventType.COMPLETED,
				expect.objectContaining({
					intentId: intent.id,
					status: IntentStatus.COMPLETED_SUCCESS,
				}),
			);
		});

		it('should remove intent from registry after completion', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
			});

			service.completeIntent(intent.id, [{ deviceId: 'device-1', status: IntentTargetStatus.SUCCESS }]);

			expect(service.getIntent(intent.id)).toBeUndefined();
		});

		it('should return null for non-existent intent', () => {
			const result = service.completeIntent('non-existent-id', []);

			expect(result).toBeNull();
		});

		it('should not re-complete an already completed intent', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
			});

			// Complete first time
			service.completeIntent(intent.id, [{ deviceId: 'device-1', status: IntentTargetStatus.SUCCESS }]);

			// Intent was removed, so second call returns null
			const secondComplete = service.completeIntent(intent.id, [
				{ deviceId: 'device-1', status: IntentTargetStatus.FAILED },
			]);

			expect(secondComplete).toBeNull();
		});
	});

	describe('getIntent', () => {
		it('should return intent by ID', () => {
			const created = service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1' }],
				value: 50,
			});

			const retrieved = service.getIntent(created.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.id).toBe(created.id);
		});

		it('should return undefined for non-existent intent', () => {
			const retrieved = service.getIntent('non-existent-id');

			expect(retrieved).toBeUndefined();
		});
	});

	describe('findActiveIntents', () => {
		beforeEach(() => {
			// Create several test intents
			service.createIntent({
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				targets: [{ deviceId: 'device-1' }],
				value: 50,
				scope: { roomId: 'room-1' },
			});

			service.createIntent({
				type: IntentType.LIGHT_SET_COLOR,
				targets: [{ deviceId: 'device-2' }],
				value: '#FF0000',
				scope: { roomId: 'room-2' },
			});

			service.createIntent({
				type: IntentType.SCENE_RUN,
				targets: [{ deviceId: 'device-3' }],
				value: {},
				scope: { sceneId: 'scene-1' },
			});
		});

		it('should find intents by deviceId', () => {
			const results = service.findActiveIntents({ deviceId: 'device-1' });

			expect(results).toHaveLength(1);
			expect(results[0].targets[0].deviceId).toBe('device-1');
		});

		it('should find intents by roomId', () => {
			const results = service.findActiveIntents({ roomId: 'room-1' });

			expect(results).toHaveLength(1);
			expect(results[0].scope?.roomId).toBe('room-1');
		});

		it('should find intents by sceneId', () => {
			const results = service.findActiveIntents({ sceneId: 'scene-1' });

			expect(results).toHaveLength(1);
			expect(results[0].scope?.sceneId).toBe('scene-1');
		});

		it('should return empty array when no matches found', () => {
			const results = service.findActiveIntents({ deviceId: 'non-existent' });

			expect(results).toHaveLength(0);
		});
	});

	describe('getActiveCount', () => {
		it('should return count of pending intents', () => {
			service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
			});

			service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-2' }],
				value: false,
			});

			expect(service.getActiveCount()).toBe(2);
		});

		it('should not count completed intents', () => {
			const intent = service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
			});

			expect(service.getActiveCount()).toBe(1);

			service.completeIntent(intent.id, [{ deviceId: 'device-1', status: IntentTargetStatus.SUCCESS }]);

			expect(service.getActiveCount()).toBe(0);
		});
	});

	describe('TTL expiration', () => {
		it('should expire intents after TTL', async () => {
			const emitSpy = jest.spyOn(eventEmitter, 'emit');

			// Create intent with very short TTL
			const intent = service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
				ttlMs: 100, // 100ms TTL
			});

			expect(service.getIntent(intent.id)).toBeDefined();

			// Wait for TTL + cleanup interval
			await new Promise((resolve) => setTimeout(resolve, 700));

			// Intent should be expired and removed
			expect(service.getIntent(intent.id)).toBeUndefined();
			expect(emitSpy).toHaveBeenCalledWith(
				IntentEventType.EXPIRED,
				expect.objectContaining({
					intentId: intent.id,
					status: IntentStatus.EXPIRED,
				}),
			);
		});

		it('should not expire completed intents', async () => {
			const emitSpy = jest.spyOn(eventEmitter, 'emit');

			const intent = service.createIntent({
				type: IntentType.LIGHT_TOGGLE,
				targets: [{ deviceId: 'device-1' }],
				value: true,
				ttlMs: 100,
			});

			// Complete before expiration
			service.completeIntent(intent.id, [{ deviceId: 'device-1', status: IntentTargetStatus.SUCCESS }]);

			// Wait for what would be expiration time
			await new Promise((resolve) => setTimeout(resolve, 700));

			// Expired event should NOT have been emitted for this intent after completion
			const expiredCalls = emitSpy.mock.calls.filter((call: [string, unknown]) => {
				const eventType = call[0];
				const payload = call[1] as { intentId: string };
				return eventType === (IntentEventType.EXPIRED as string) && payload.intentId === intent.id;
			});

			expect(expiredCalls).toHaveLength(0);
		});
	});
});
