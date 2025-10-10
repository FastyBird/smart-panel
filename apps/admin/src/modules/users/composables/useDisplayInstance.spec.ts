import { type Ref, ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { DisplaysInstancesStore, IDisplayInstance, IDisplaysInstancesStateSemaphore } from '../store/displays-instances.store.types';

import { useDisplayInstance } from './useDisplayInstance';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDisplayInstance', (): void => {
	let displaysStoreMock: DisplaysInstancesStore;

	beforeEach((): void => {
		displaysStoreMock = {
			get: vi.fn().mockResolvedValue(undefined),
			data: ref([]),
			semaphore: ref({
				fetching: {
					items: false,
					item: [],
				},
			}),
		} as DisplaysInstancesStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => displaysStoreMock),
		});
	});

	it('should return null when id is null', (): void => {
		const { display } = useDisplayInstance({ id: '' });

		expect(display.value).toBeNull();
	});

	it('should return display instance when found in store', (): void => {
		const displayData = { id: 'display1', mac: '00:1A:2B:3C:4D:5E' };

		(displaysStoreMock.data as unknown as Ref<{ [key: IDisplayInstance['id']]: IDisplayInstance }>).value = {
			display1: displayData as IDisplayInstance,
		};

		const { display } = useDisplayInstance({ id: 'display1' });

		expect(display.value).toEqual(displayData);
	});

	it('should call get() when display instance is missing', async (): Promise<void> => {
		const { fetchDisplay } = useDisplayInstance({ id: 'display1' });

		await fetchDisplay();

		expect(displaysStoreMock.get).toHaveBeenCalledWith({ id: 'display1' });
	});

	it('should not call get() when display instance is a draft', async (): Promise<void> => {
		(displaysStoreMock.data as unknown as Ref<{ [key: IDisplayInstance['id']]: IDisplayInstance }>).value = {
			display1: { id: 'display1', draft: true } as IDisplayInstance,
		};

		const { fetchDisplay } = useDisplayInstance({ id: 'display1' });

		await fetchDisplay();

		expect(displaysStoreMock.get).not.toHaveBeenCalled();
	});

	it('should return isLoading as true when fetching or getting display instance', (): void => {
		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysInstancesStateSemaphore>).value = {
			fetching: {
				items: false,
				item: ['display1'],
			},
		} as unknown as IDisplaysInstancesStateSemaphore;

		const { isLoading } = useDisplayInstance({ id: 'display1' });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading as false when display instance exists in store', (): void => {
		(displaysStoreMock.data as unknown as Ref<{ [key: IDisplayInstance['id']]: IDisplayInstance }>).value = {
			display1: { id: 'display1' } as IDisplayInstance,
		};

		const { isLoading } = useDisplayInstance({ id: 'display1' });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading as false when fetching() returns false', (): void => {
		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysInstancesStateSemaphore>).value = {
			fetching: {
				items: false,
				item: [],
			},
		} as unknown as IDisplaysInstancesStateSemaphore;

		const { isLoading } = useDisplayInstance({ id: 'display1' });

		expect(isLoading.value).toBe(false);
	});
});
