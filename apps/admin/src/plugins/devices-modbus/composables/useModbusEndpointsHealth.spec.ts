import { defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { modbusEndpointsStoreKey } from '../store/keys';

import { useModbusEndpointsHealth } from './useModbusEndpointsHealth';

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

const mountComposable = (intervalMs?: number) =>
	mount(
		defineComponent({
			setup() {
				useModbusEndpointsHealth(intervalMs);

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

	it('keeps polling when one endpoint fails', async () => {
		store.fetchHealth.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({});

		const wrapper = mountComposable(1000);
		await flushPromises();

		expect(store.fetchHealth).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});
});
