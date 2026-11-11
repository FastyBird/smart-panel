import { defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { modbusEndpointsStoreKey } from '../store/keys';

import { MODBUS_HEALTH_ROUND_SIZE, healthRoundDelay, useModbusEndpointsHealth } from './useModbusEndpointsHealth';

const store = {
	findAll: vi.fn(),
	fetch: vi.fn(),
	fetchHealth: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === modbusEndpointsStoreKey) return store;

				throw new Error('Unexpected store');
			},
		}),
	};
});

let refreshFn: () => Promise<void> = async () => undefined;

const mountComposable = (intervalMs?: number) =>
	mount(
		defineComponent({
			setup() {
				refreshFn = useModbusEndpointsHealth(intervalMs).refresh;

				return () => null;
			},
		})
	);

describe('useModbusEndpointsHealth', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		store.findAll.mockReturnValue([{ id: 'a' }, { id: 'b' }]);
		store.fetchHealth.mockResolvedValue({});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('polls every interval and stops on unmount', async () => {
		const wrapper = mountComposable(5000);
		await flushPromises();

		expect(store.fetchHealth).toHaveBeenCalledTimes(2);
		expect(store.fetchHealth).toHaveBeenCalledWith('a');
		expect(store.fetchHealth).toHaveBeenCalledWith('b');

		await vi.advanceTimersByTimeAsync(5000);
		expect(store.fetchHealth).toHaveBeenCalledTimes(4);

		wrapper.unmount();
		await vi.advanceTimersByTimeAsync(20000);
		expect(store.fetchHealth).toHaveBeenCalledTimes(4);
	});

	it('stretches the pause so many endpoints stay within the health request budget', async () => {
		expect(healthRoundDelay(2, 5000)).toBe(5000);
		expect(healthRoundDelay(21, 5000)).toBe(10_500);

		store.findAll.mockReturnValue(Array.from({ length: 30 }, (_, index) => ({ id: `e${index}` })));

		const wrapper = mountComposable(5000);
		await flushPromises();
		expect(store.fetchHealth).toHaveBeenCalledTimes(30);

		await vi.advanceTimersByTimeAsync(14_999);
		expect(store.fetchHealth).toHaveBeenCalledTimes(30);

		await vi.advanceTimersByTimeAsync(1);
		expect(store.fetchHealth).toHaveBeenCalledTimes(60);

		wrapper.unmount();
	});

	it('never overlaps rounds', async () => {
		let release: () => void = () => undefined;
		store.fetchHealth.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
		store.findAll.mockReturnValue([{ id: 'a' }]);

		const wrapper = mountComposable(1000);
		await flushPromises();
		expect(store.fetchHealth).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(3000);
		expect(store.fetchHealth).toHaveBeenCalledTimes(1);

		release();
		await flushPromises();
		await vi.advanceTimersByTimeAsync(1000);
		expect(store.fetchHealth).toHaveBeenCalledTimes(2);

		wrapper.unmount();
	});

	it('fetches health on refresh for endpoints that appeared after mount', async () => {
		store.findAll.mockReturnValue([]);
		const wrapper = mountComposable(5000);
		await flushPromises();
		expect(store.fetchHealth).not.toHaveBeenCalled();

		store.findAll.mockReturnValue([{ id: 'a' }]);
		await refreshFn();

		expect(store.fetchHealth).toHaveBeenCalledWith('a');
		wrapper.unmount();
	});

	it('keeps polling when one endpoint fails', async () => {
		store.fetchHealth.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({});

		const wrapper = mountComposable(1000);
		await flushPromises();

		expect(store.fetchHealth).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	it('asks at most one round size of endpoints per round and continues with the rest in the next rounds', async () => {
		const endpoints = Array.from({ length: 250 }, (_, index) => ({ id: `e${index}` }));
		store.findAll.mockReturnValue(endpoints);

		expect(healthRoundDelay(250, 5000)).toBe(60_000);

		const asked = (): string[] => store.fetchHealth.mock.calls.map(([id]) => id as string);

		const wrapper = mountComposable(5000);
		await flushPromises();

		expect(asked()).toHaveLength(MODBUS_HEALTH_ROUND_SIZE);
		expect(asked()[0]).toBe('e0');

		await vi.advanceTimersByTimeAsync(60_000);
		await vi.advanceTimersByTimeAsync(60_000);

		const all = asked();

		expect(all).toHaveLength(MODBUS_HEALTH_ROUND_SIZE * 3);
		// The third round wraps around to the start of the list.
		expect(all[MODBUS_HEALTH_ROUND_SIZE]).toBe(`e${MODBUS_HEALTH_ROUND_SIZE}`);
		expect(new Set(all).size).toBe(250);

		wrapper.unmount();
	});
});
