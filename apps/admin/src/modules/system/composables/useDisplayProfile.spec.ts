import { type Ref, ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { DisplaysProfilesStore, IDisplayProfile, IDisplaysProfilesStateSemaphore } from '../store/displays-profiles.store.types';

import { useDisplayProfile } from './useDisplayProfile';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDisplayProfile', (): void => {
	let displaysStoreMock: DisplaysProfilesStore;

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
		} as DisplaysProfilesStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => displaysStoreMock),
		});
	});

	it('should return null when id is null', (): void => {
		const { display } = useDisplayProfile({ id: '' });

		expect(display.value).toBeNull();
	});

	it('should return display profile when found in store', (): void => {
		const displayData = { id: 'display1', uid: 'uid1' };

		(displaysStoreMock.data as unknown as Ref<{ [key: IDisplayProfile['id']]: IDisplayProfile }>).value = {
			display1: displayData as IDisplayProfile,
		};

		const { display } = useDisplayProfile({ id: 'display1' });

		expect(display.value).toEqual(displayData);
	});

	it('should call get() when display profile is missing', async (): Promise<void> => {
		const { fetchDisplay } = useDisplayProfile({ id: 'display1' });

		await fetchDisplay();

		expect(displaysStoreMock.get).toHaveBeenCalledWith({ id: 'display1' });
	});

	it('should return isLoading as true when fetching or getting display profile', (): void => {
		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysProfilesStateSemaphore>).value = {
			fetching: {
				items: false,
				item: ['display1'],
			},
		} as unknown as IDisplaysProfilesStateSemaphore;

		const { isLoading } = useDisplayProfile({ id: 'display1' });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading as false when display profile exists in store', (): void => {
		(displaysStoreMock.data as unknown as Ref<{ [key: IDisplayProfile['id']]: IDisplayProfile }>).value = {
			display1: { id: 'display1' } as IDisplayProfile,
		};

		const { isLoading } = useDisplayProfile({ id: 'display1' });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading as false when fetching() returns false', (): void => {
		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysProfilesStateSemaphore>).value = {
			fetching: {
				items: false,
				item: [],
			},
		} as unknown as IDisplaysProfilesStateSemaphore;

		const { isLoading } = useDisplayProfile({ id: 'display1' });

		expect(isLoading.value).toBe(false);
	});
});
