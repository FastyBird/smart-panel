import { IntentType } from '../../intents/intents.constants';
import { ActionObserverService } from '../services/action-observer.service';

import { IntentEventListener } from './intent-event.listener';

jest.mock('@nestjs/event-emitter', () => ({
	OnEvent: () => () => undefined,
}));

describe('IntentEventListener', () => {
	let listener: IntentEventListener;
	let actionObserver: ActionObserverService;

	beforeEach(() => {
		actionObserver = new ActionObserverService();
		listener = new IntentEventListener(actionObserver);
	});

	describe('handleIntentCompleted', () => {
		it('should record a completed intent action', () => {
			listener.handleIntentCompleted({
				intent_id: 'intent-1',
				type: IntentType.LIGHT_TOGGLE,
				context: { space_id: 'space-1' },
				targets: [{ device_id: 'dev-1' }],
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].intentId).toBe('intent-1');
			expect(actions[0].type).toBe(IntentType.LIGHT_TOGGLE);
			expect(actions[0].spaceId).toBe('space-1');
			expect(actions[0].deviceIds).toEqual(['dev-1']);
			expect(actions[0].timestamp).toBeInstanceOf(Date);
		});

		it('should not record an intent that an automation started', () => {
			// The payload of a device write and of a scene run started by an automation
			listener.handleIntentCompleted({
				intent_id: 'intent-auto-1',
				type: IntentType.DEVICE_SET_PROPERTY,
				context: { origin: 'automation', extra: { automationId: 'automation-1' } },
				targets: [{ device_id: 'dev-1' }],
			});
			listener.handleIntentCompleted({
				intent_id: 'intent-auto-2',
				type: IntentType.SCENE_RUN,
				context: { origin: 'automation', space_id: 'space-1', extra: { automationId: 'automation-1' } },
				targets: [{ scene_id: 'scene-1' }, { device_id: 'dev-1' }],
			});

			expect(actionObserver.getRecentActions()).toEqual([]);
		});

		it('should record the origin of an intent a person started', () => {
			listener.handleIntentCompleted({
				intent_id: 'intent-panel',
				type: IntentType.DEVICE_SET_PROPERTY,
				context: { origin: 'panel.device', space_id: 'space-1' },
				targets: [{ device_id: 'dev-1' }],
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].origin).toBe('panel.device');
		});

		it('should extract multiple device IDs from targets', () => {
			listener.handleIntentCompleted({
				intent_id: 'intent-2',
				type: IntentType.SPACE_LIGHTING_ON,
				context: { space_id: 'space-2' },
				targets: [{ device_id: 'dev-a' }, { device_id: 'dev-b' }, { device_id: 'dev-c' }],
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].deviceIds).toEqual(['dev-a', 'dev-b', 'dev-c']);
		});

		it('should skip null device IDs in targets', () => {
			listener.handleIntentCompleted({
				intent_id: 'intent-3',
				type: IntentType.SCENE_RUN,
				context: { space_id: 'space-1' },
				targets: [{ device_id: 'dev-1' }, { device_id: null }, { device_id: 'dev-3' }],
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].deviceIds).toEqual(['dev-1', 'dev-3']);
		});

		it('should handle missing targets gracefully', () => {
			listener.handleIntentCompleted({
				intent_id: 'intent-4',
				type: IntentType.LIGHT_SET_BRIGHTNESS,
				context: { space_id: 'space-1' },
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].deviceIds).toEqual([]);
		});

		it('should handle missing context gracefully', () => {
			listener.handleIntentCompleted({
				intent_id: 'intent-5',
				type: IntentType.DEVICE_SET_PROPERTY,
				targets: [{ device_id: 'dev-1' }],
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].spaceId).toBeNull();
			expect(actions[0].deviceIds).toEqual(['dev-1']);
		});

		it('should handle completely empty payload gracefully without throwing', () => {
			listener.handleIntentCompleted({});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].intentId).toBeUndefined();
			expect(actions[0].spaceId).toBeNull();
			expect(actions[0].deviceIds).toEqual([]);
		});

		it('should handle errors in action observer without throwing', () => {
			const mockObserver = {
				recordAction: jest.fn().mockImplementation(() => {
					throw new Error('Storage failure');
				}),
			};

			const errorListener = new IntentEventListener(mockObserver as unknown as ActionObserverService);

			// Should not throw thanks to the try/catch in the listener
			expect(() => {
				errorListener.handleIntentCompleted({
					intent_id: 'intent-err',
					type: IntentType.LIGHT_TOGGLE,
					context: { space_id: 'space-1' },
					targets: [{ device_id: 'dev-1' }],
				});
			}).not.toThrow();
		});

		it('should handle malformed targets array without throwing', () => {
			expect(() => {
				listener.handleIntentCompleted({
					intent_id: 'intent-bad',
					type: IntentType.LIGHT_TOGGLE,
					targets: 'not-an-array' as any,
				});
			}).not.toThrow();
		});

		it('should record actions with correct intent types', () => {
			const types = [IntentType.SPACE_CLIMATE_SET_MODE, IntentType.SPACE_COVERS_OPEN, IntentType.SPACE_MEDIA_ACTIVATE];

			for (const type of types) {
				listener.handleIntentCompleted({
					intent_id: `intent-${type}`,
					type,
					context: { space_id: 'space-1' },
					targets: [],
				});
			}

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(3);
			expect(actions.map((a) => a.type)).toEqual(types);
		});

		it('should record separate actions for multiple events', () => {
			listener.handleIntentCompleted({
				intent_id: 'intent-first',
				type: IntentType.LIGHT_TOGGLE,
				context: { space_id: 'space-1' },
				targets: [{ device_id: 'dev-1' }],
			});

			listener.handleIntentCompleted({
				intent_id: 'intent-second',
				type: IntentType.SCENE_RUN,
				context: { space_id: 'space-2' },
				targets: [],
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(2);
			expect(actions[0].intentId).toBe('intent-first');
			expect(actions[1].intentId).toBe('intent-second');
		});
	});
});
