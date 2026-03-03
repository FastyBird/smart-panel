import { IntentType } from '../../intents/intents.constants';
import { ActionObserverService } from '../services/action-observer.service';

import { MediaActivityEventListener } from './media-activity-event.listener';

describe('MediaActivityEventListener', () => {
	let listener: MediaActivityEventListener;
	let actionObserver: ActionObserverService;

	beforeEach(() => {
		actionObserver = new ActionObserverService();
		listener = new MediaActivityEventListener(actionObserver);
	});

	describe('handleMediaActivated', () => {
		it('should record a media activate action with device IDs from resolved payload', () => {
			listener.handleMediaActivated({
				space_id: 'space-1',
				activity_key: 'watch',
				resolved: {
					display_device_id: 'tv-1',
					audio_device_id: 'avr-1',
					source_device_id: 'streamer-1',
				},
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].type).toBe(IntentType.SPACE_MEDIA_ACTIVATE);
			expect(actions[0].spaceId).toBe('space-1');
			expect(actions[0].deviceIds).toEqual(['tv-1', 'avr-1', 'streamer-1']);
		});

		it('should handle activation without resolved devices', () => {
			listener.handleMediaActivated({
				space_id: 'space-1',
				activity_key: 'listen',
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].type).toBe(IntentType.SPACE_MEDIA_ACTIVATE);
			expect(actions[0].deviceIds).toEqual([]);
		});

		it('should skip null device IDs in resolved payload', () => {
			listener.handleMediaActivated({
				space_id: 'space-1',
				activity_key: 'watch',
				resolved: {
					display_device_id: 'tv-1',
					audio_device_id: undefined,
					source_device_id: undefined,
					remote_device_id: 'remote-1',
				},
			});

			const actions = actionObserver.getRecentActions();

			expect(actions[0].deviceIds).toEqual(['tv-1', 'remote-1']);
		});
	});

	describe('handleMediaDeactivated', () => {
		it('should record a media deactivate action', () => {
			listener.handleMediaDeactivated({
				space_id: 'space-1',
				activity_key: null,
			});

			const actions = actionObserver.getRecentActions();

			expect(actions).toHaveLength(1);
			expect(actions[0].type).toBe(IntentType.SPACE_MEDIA_DEACTIVATE);
			expect(actions[0].spaceId).toBe('space-1');
			expect(actions[0].deviceIds).toEqual([]);
		});
	});

	describe('getRecentActionsBySpace', () => {
		it('should filter media actions by space ID', () => {
			listener.handleMediaActivated({
				space_id: 'space-1',
				activity_key: 'watch',
			});

			listener.handleMediaActivated({
				space_id: 'space-2',
				activity_key: 'listen',
			});

			const space1Actions = actionObserver.getRecentActionsBySpace('space-1');

			expect(space1Actions).toHaveLength(1);
			expect(space1Actions[0].spaceId).toBe('space-1');
		});
	});
});
