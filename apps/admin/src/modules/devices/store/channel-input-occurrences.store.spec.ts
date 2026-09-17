import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_OCCURRENCES_STORED, useChannelInputOccurrencesStore } from './channel-input-occurrences.store';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
	};
});

describe('channel-input-occurrences.store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('starts with empty occurrences', () => {
		const store = useChannelInputOccurrencesStore();
		expect(store.occurrences).toEqual([]);
		expect(store.findByChannel('ch-1')).toEqual([]);
		expect(store.findLatestForChannel('ch-1')).toBeNull();
	});

	it('records a new input occurrence with camelCase or snake_case payload', () => {
		const store = useChannelInputOccurrencesStore();

		store.onEvent({
			id: 'occ-1',
			deviceId: 'dev-1',
			channelId: 'ch-1',
			propertyId: 'prop-1',
			event: 'press',
			timestamp: '2026-09-17T12:00:00.000Z',
			sourceTimestamp: '2026-09-17T12:00:00.000Z',
			nativeEventType: 'single_push',
		});

		expect(store.occurrences).toHaveLength(1);
		const recorded = store.occurrences[0];
		expect(recorded.id).toBe('occ-1');
		expect(recorded.deviceId).toBe('dev-1');
		expect(recorded.channelId).toBe('ch-1');
		expect(recorded.propertyId).toBe('prop-1');
		expect(recorded.event).toBe('press');
		expect(recorded.nativeEventType).toBe('single_push');
	});

	it('records two identical clicks as two distinct entries', () => {
		const store = useChannelInputOccurrencesStore();

		store.onEvent({
			id: 'occ-1',
			deviceId: 'dev-1',
			channelId: 'ch-1',
			event: 'press',
			timestamp: '2026-09-17T12:00:00.000Z',
		});

		store.onEvent({
			id: 'occ-2',
			deviceId: 'dev-1',
			channelId: 'ch-1',
			event: 'press',
			timestamp: '2026-09-17T12:00:01.000Z',
		});

		expect(store.occurrences).toHaveLength(2);
		expect(store.occurrences[0].id).toBe('occ-2');
		expect(store.occurrences[1].id).toBe('occ-1');

		const latest = store.findLatestForChannel('ch-1');
		expect(latest?.id).toBe('occ-2');
	});

	it('limits total occurrences to MAX_OCCURRENCES_STORED', () => {
		const store = useChannelInputOccurrencesStore();

		for (let i = 0; i < MAX_OCCURRENCES_STORED + 20; i++) {
			store.onEvent({
				id: `occ-${i}`,
				deviceId: 'dev-1',
				channelId: 'ch-1',
				event: 'press',
				timestamp: `2026-09-17T12:00:${String(i).padStart(2, '0')}.000Z`,
			});
		}

		expect(store.occurrences).toHaveLength(MAX_OCCURRENCES_STORED);
		expect(store.occurrences[0].id).toBe(`occ-${MAX_OCCURRENCES_STORED + 19}`);
	});

	it('filters occurrences by channel and device', () => {
		const store = useChannelInputOccurrencesStore();

		store.onEvent({ id: 'occ-1', deviceId: 'dev-1', channelId: 'ch-1', event: 'press' });
		store.onEvent({ id: 'occ-2', deviceId: 'dev-1', channelId: 'ch-2', event: 'double_press' });
		store.onEvent({ id: 'occ-3', deviceId: 'dev-2', channelId: 'ch-3', event: 'long_press' });

		expect(store.findByChannel('ch-1')).toHaveLength(1);
		expect(store.findByChannel('ch-1')[0].id).toBe('occ-1');

		expect(store.findByDevice('dev-1')).toHaveLength(2);
		expect(store.findByDevice('dev-2')).toHaveLength(1);
	});

	it('clears all occurrences or occurrences for a specific channel', () => {
		const store = useChannelInputOccurrencesStore();

		store.onEvent({ id: 'occ-1', deviceId: 'dev-1', channelId: 'ch-1', event: 'press' });
		store.onEvent({ id: 'occ-2', deviceId: 'dev-1', channelId: 'ch-2', event: 'press' });

		store.clear('ch-1');
		expect(store.findByChannel('ch-1')).toHaveLength(0);
		expect(store.findByChannel('ch-2')).toHaveLength(1);

		store.clear();
		expect(store.occurrences).toHaveLength(0);
	});

	it('ignores invalid event payloads without throwing', () => {
		const store = useChannelInputOccurrencesStore();

		expect(() => store.onEvent(null as unknown as Record<string, unknown>)).not.toThrow();
		expect(() => store.onEvent({} as Record<string, unknown>)).not.toThrow();
		expect(store.occurrences).toHaveLength(0);
	});
});
