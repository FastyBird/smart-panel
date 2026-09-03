import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { RemoteAccessModuleAdvisorySeverity } from '../../../openapi.constants';
import type { IRemoteAccessStatus } from '../store/remote-access-status.store.types';

import { useRemoteAccessStatus } from './useRemoteAccessStatus';

const mockStatus: IRemoteAccessStatus = {
	enabled: true,
	providers: [],
	urls: { internal: 'http://localhost:3000', candidates: [], external: [], primary: null },
	advisories: [
		{ code: 'public-exposure', severity: RemoteAccessModuleAdvisorySeverity.warning, message: 'Reachable from the internet.' },
		{ code: 'external-url-insecure', severity: RemoteAccessModuleAdvisorySeverity.critical, message: 'HTTP is insecure.' },
	],
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useRemoteAccessStatus', () => {
	let get: Mock;

	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref<IRemoteAccessStatus | null>;
		semaphore: Ref<{ getting: boolean }>;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();

		mockStore = {
			get,
			$id: 'remote_access_module-status',
			data: ref(null),
			semaphore: ref({ getting: false }),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns null status and false enabled before the first fetch', () => {
		const { status, enabled, advisories } = useRemoteAccessStatus();

		expect(status.value).toBeNull();
		expect(enabled.value).toBe(false);
		expect(advisories.value).toEqual([]);
	});

	it('exposes the loaded status, enabled flag and advisories', () => {
		mockStore.data.value = mockStatus;

		const { status, enabled, advisories } = useRemoteAccessStatus();

		expect(status.value).toEqual(mockStatus);
		expect(enabled.value).toBe(true);
		expect(advisories.value).toHaveLength(2);
	});

	it('reports isLoading true only while fetching and not yet loaded', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useRemoteAccessStatus();

		expect(isLoading.value).toBe(true);
	});

	it('reports isLoading false once data is present, even if fetching again', () => {
		mockStore.data.value = mockStatus;
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useRemoteAccessStatus();

		expect(isLoading.value).toBe(false);
	});

	it('delegates fetchStatus to the store', async () => {
		const { fetchStatus } = useRemoteAccessStatus();

		await fetchStatus();

		expect(get).toHaveBeenCalled();
	});
});
