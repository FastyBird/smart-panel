import { ACTIVITY_STATE_CHANGED } from '../activity/space-activity.constants';
import { SPACE_OCCUPANCY_CHANGED } from '../occupancy/space-occupancy.types';

import { SpaceAutomationEventsService } from './space-automation-events.service';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';
const OTHER_SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000002';

describe('SpaceAutomationEventsService', () => {
	let service: SpaceAutomationEventsService;

	beforeEach(() => {
		service = new SpaceAutomationEventsService();
	});

	it('hands an occupancy hint to the triggers watching that space only', () => {
		const watching = jest.fn();
		const other = jest.fn();

		service.onOccupancyChanged(SPACE, watching);
		service.onOccupancyChanged(OTHER_SPACE, other);

		service.handleOccupancyChanged({ space_id: SPACE });

		expect(watching).toHaveBeenCalledTimes(1);
		expect(other).not.toHaveBeenCalled();
	});

	it('hands an activity hint to the mode triggers, not to the occupancy ones', () => {
		const mode = jest.fn();
		const occupancy = jest.fn();

		service.onModeChanged(SPACE, mode);
		service.onOccupancyChanged(SPACE, occupancy);

		service.handleActivityStateChanged({ space_id: SPACE, activation_id: 'a-1', configuration_revision: 1 });

		expect(mode).toHaveBeenCalledTimes(1);
		expect(occupancy).not.toHaveBeenCalled();
	});

	it('listens to the bus events of occupancy and of the activity selection', () => {
		const handlers = (name: string): unknown =>
			Reflect.getMetadata(
				'EVENT_LISTENER_METADATA',
				(SpaceAutomationEventsService.prototype as unknown as Record<string, object>)[name],
			);

		expect(JSON.stringify(handlers('handleOccupancyChanged'))).toContain(SPACE_OCCUPANCY_CHANGED);
		expect(JSON.stringify(handlers('handleActivityStateChanged'))).toContain(ACTIVITY_STATE_CHANGED);
	});

	it('ignores an event without a space', () => {
		const listener = jest.fn();

		service.onOccupancyChanged(SPACE, listener);
		service.handleOccupancyChanged(null);
		service.handleOccupancyChanged({ space_id: 42 });

		expect(listener).not.toHaveBeenCalled();
	});

	it('still calls the other listeners when one throws', () => {
		const broken = jest.fn(() => {
			throw new Error('broken');
		});
		const listener = jest.fn();

		service.onModeChanged(SPACE, broken);
		service.onModeChanged(SPACE, listener);

		expect(() => service.handleActivityStateChanged({ space_id: SPACE })).not.toThrow();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('releases a listener once, also a listener subscribed twice', () => {
		const listener = jest.fn();
		const first = service.onModeChanged(SPACE, listener);
		const second = service.onModeChanged(SPACE, listener);

		expect(service.subscriptionCount()).toBe(2);

		first();
		first();

		expect(service.subscriptionCount()).toBe(1);

		service.handleActivityStateChanged({ space_id: SPACE });

		expect(listener).toHaveBeenCalledTimes(1);

		second();

		expect(service.subscriptionCount()).toBe(0);
	});
});
