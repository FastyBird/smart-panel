import mitt from 'mitt';
import { describe, expect, it, vi } from 'vitest';

import { useEventBus } from './useEventBus';

const mockEventBus = mitt();
vi.spyOn(mockEventBus, 'on');
vi.spyOn(mockEventBus, 'off');
vi.spyOn(mockEventBus, 'emit');

vi.mock('../services', () => ({
	injectEventBus: vi.fn(() => mockEventBus),
}));

describe('useEventBus', () => {
	it('registers an event listener', () => {
		const { register } = useEventBus();
		const handler = vi.fn();

		register('testEvent', handler);

		expect(mockEventBus.on).toHaveBeenCalledWith('testEvent', handler);
	});

	it('unregisters an event listener', () => {
		const { unregister } = useEventBus();
		const handler = vi.fn();

		unregister('testEvent', handler);

		expect(mockEventBus.off).toHaveBeenCalledWith('testEvent', handler);
	});

	it('emits an event with payload', () => {
		const { emit } = useEventBus();
		const payload = { message: 'Hello World' };

		emit('testEvent', payload);

		expect(mockEventBus.emit).toHaveBeenCalledWith('testEvent', payload);
	});
});
