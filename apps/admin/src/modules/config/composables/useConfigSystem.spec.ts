import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { ConfigModuleSystemLog_levels, ConfigModuleSystemType } from '../../../openapi';
import type { IConfigSystem } from '../store/config-system.store.types';

import { useConfigSystem } from './useConfigSystem';

const mockSystem: IConfigSystem = {
	type: ConfigModuleSystemType.system,
	logLevels: [ConfigModuleSystemLog_levels.info, ConfigModuleSystemLog_levels.warn, ConfigModuleSystemLog_levels.error],
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useConfigSystem', () => {
	let get: Mock;

	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();

		mockStore = {
			get,
			$id: 'configSystem',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a config', () => {
		mockStore.data.value = mockSystem;

		const { configSystem } = useConfigSystem();

		expect(configSystem.value).toEqual(mockSystem);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useConfigSystem();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useConfigSystem();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchConfigSystem and triggers store.get', async () => {
		const { fetchConfigSystem } = useConfigSystem();

		await fetchConfigSystem();

		expect(get).toHaveBeenCalled();
	});
});
