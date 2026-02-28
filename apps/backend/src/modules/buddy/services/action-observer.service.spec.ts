import { IntentType } from '../../intents/intents.constants';

import { ActionObserverService, ActionRecord } from './action-observer.service';

function makeAction(overrides: Partial<ActionRecord> = {}): ActionRecord {
	return {
		intentId: overrides.intentId ?? 'intent-1',
		type: overrides.type ?? IntentType.LIGHT_TOGGLE,
		spaceId: overrides.spaceId ?? 'space-1',
		deviceIds: overrides.deviceIds ?? ['dev-1'],
		timestamp: overrides.timestamp ?? new Date(),
	};
}

describe('ActionObserverService', () => {
	let service: ActionObserverService;

	beforeEach(() => {
		service = new ActionObserverService();
	});

	describe('recordAction', () => {
		it('should add an action to the buffer', () => {
			const action = makeAction();

			service.recordAction(action);

			expect(service.getBufferSize()).toBe(1);

			const actions = service.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0]).toEqual(action);
		});

		it('should add multiple actions to the buffer', () => {
			service.recordAction(makeAction({ intentId: 'a' }));
			service.recordAction(makeAction({ intentId: 'b' }));
			service.recordAction(makeAction({ intentId: 'c' }));

			expect(service.getBufferSize()).toBe(3);
		});

		it('should remove oldest action when buffer overflows', () => {
			// The buffer size is 200 (ACTION_OBSERVER_BUFFER_SIZE).
			// Fill to capacity, then add one more.
			for (let i = 0; i < 200; i++) {
				service.recordAction(makeAction({ intentId: `intent-${i}` }));
			}

			expect(service.getBufferSize()).toBe(200);

			service.recordAction(makeAction({ intentId: 'overflow' }));

			expect(service.getBufferSize()).toBe(200);

			const actions = service.getRecentActions();

			// Oldest (intent-0) should be gone
			expect(actions[0].intentId).toBe('intent-1');
			// Newest should be at end
			expect(actions[actions.length - 1].intentId).toBe('overflow');
		});
	});

	describe('getRecentActions', () => {
		it('should return all actions when no limit is given', () => {
			service.recordAction(makeAction({ intentId: 'a' }));
			service.recordAction(makeAction({ intentId: 'b' }));
			service.recordAction(makeAction({ intentId: 'c' }));

			const actions = service.getRecentActions();

			expect(actions).toHaveLength(3);
		});

		it('should return last N actions when limit is given', () => {
			service.recordAction(makeAction({ intentId: 'a' }));
			service.recordAction(makeAction({ intentId: 'b' }));
			service.recordAction(makeAction({ intentId: 'c' }));

			const actions = service.getRecentActions(2);

			expect(actions).toHaveLength(2);
			expect(actions[0].intentId).toBe('b');
			expect(actions[1].intentId).toBe('c');
		});

		it('should return all actions when limit exceeds buffer size', () => {
			service.recordAction(makeAction({ intentId: 'a' }));
			service.recordAction(makeAction({ intentId: 'b' }));

			const actions = service.getRecentActions(10);

			expect(actions).toHaveLength(2);
		});

		it('should return empty array when buffer is empty', () => {
			const actions = service.getRecentActions();

			expect(actions).toHaveLength(0);
		});

		it('should return a copy, not a reference to internal buffer', () => {
			service.recordAction(makeAction({ intentId: 'a' }));

			const actions = service.getRecentActions();

			actions.push(makeAction({ intentId: 'pushed' }));

			expect(service.getBufferSize()).toBe(1);
		});
	});

	describe('getRecentActionsBySpace', () => {
		it('should return only actions matching the space ID', () => {
			service.recordAction(makeAction({ intentId: 'a', spaceId: 'living-room' }));
			service.recordAction(makeAction({ intentId: 'b', spaceId: 'bedroom' }));
			service.recordAction(makeAction({ intentId: 'c', spaceId: 'living-room' }));

			const actions = service.getRecentActionsBySpace('living-room');

			expect(actions).toHaveLength(2);
			expect(actions.every((a) => a.spaceId === 'living-room')).toBe(true);
		});

		it('should respect the limit parameter', () => {
			service.recordAction(makeAction({ intentId: 'a', spaceId: 'living-room' }));
			service.recordAction(makeAction({ intentId: 'b', spaceId: 'living-room' }));
			service.recordAction(makeAction({ intentId: 'c', spaceId: 'living-room' }));

			const actions = service.getRecentActionsBySpace('living-room', 2);

			expect(actions).toHaveLength(2);
			expect(actions[0].intentId).toBe('b');
			expect(actions[1].intentId).toBe('c');
		});

		it('should return empty array when no actions match', () => {
			service.recordAction(makeAction({ spaceId: 'bedroom' }));

			const actions = service.getRecentActionsBySpace('kitchen');

			expect(actions).toHaveLength(0);
		});
	});

	describe('getBufferSize', () => {
		it('should return 0 for empty buffer', () => {
			expect(service.getBufferSize()).toBe(0);
		});

		it('should return correct count after adding actions', () => {
			service.recordAction(makeAction());
			service.recordAction(makeAction());

			expect(service.getBufferSize()).toBe(2);
		});
	});
});
