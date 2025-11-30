import { type Ref, ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { SystemModuleExtensionSurface } from '../../../openapi.constants';
import type { ExtensionsStore, IExtension, IExtensionsStateSemaphore } from '../store/extensions.store.types';

import { useExtension } from './useExtension';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useExtension', (): void => {
	let extensionsStoreMock: ExtensionsStore;

	beforeEach((): void => {
		extensionsStoreMock = {
			get: vi.fn().mockResolvedValue(undefined),
			data: ref([]),
			semaphore: ref({
				fetching: {
					items: false,
					item: [],
				},
			}),
		} as ExtensionsStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => extensionsStoreMock),
		});
	});

	it('should return null when name is null', (): void => {
		const { extension } = useExtension({ name: '' });

		expect(extension.value).toBeNull();
	});

	it('should return extension when found in store', (): void => {
		const extensionData = { name: 'extension1', surface: SystemModuleExtensionSurface.admin };

		(extensionsStoreMock.data as unknown as Ref<{ [key: IExtension['name']]: { admin?: IExtension; backend?: IExtension } }>).value = {
			extension1: { admin: extensionData as IExtension },
		};

		const { extension } = useExtension({ name: 'extension1' });

		expect(extension.value).toEqual({ admin: extensionData });
	});

	it('should call get() when extension is missing', async (): Promise<void> => {
		const { fetchExtension } = useExtension({ name: 'extension1' });

		await fetchExtension();

		expect(extensionsStoreMock.get).toHaveBeenCalledWith({ name: 'extension1' });
	});

	it('should return isLoading as true when fetching or getting extension', (): void => {
		(extensionsStoreMock.semaphore as unknown as Ref<IExtensionsStateSemaphore>).value = {
			fetching: {
				items: false,
				item: ['extension1'],
			},
		} as unknown as IExtensionsStateSemaphore;

		const { isLoading } = useExtension({ name: 'extension1' });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading as false when extension exists in store', (): void => {
		(extensionsStoreMock.data as unknown as Ref<{ [key: IExtension['name']]: { admin?: IExtension; backend?: IExtension } }>).value = {
			extension1: { admin: { name: 'extension1' } as IExtension },
		};

		const { isLoading } = useExtension({ name: 'extension1' });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading as false when fetching() returns false', (): void => {
		(extensionsStoreMock.semaphore as unknown as Ref<IExtensionsStateSemaphore>).value = {
			fetching: {
				items: false,
				item: [],
			},
		} as unknown as IExtensionsStateSemaphore;

		const { isLoading } = useExtension({ name: 'extension1' });

		expect(isLoading.value).toBe(false);
	});
});
