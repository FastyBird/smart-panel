import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionsApiException } from '../extensions.exceptions';

import { useExtensionActions } from './useExtensionActions';

const mockExtensionsStore = {
	update: vi.fn(),
};

const mockServicesStore = {
	fetch: vi.fn().mockResolvedValue(undefined),
	findAll: vi.fn().mockReturnValue([]),
};

const mockFlashMessage = {
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warning: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: vi.fn(() => ({
		t: (key: string) => key,
	})),
}));

vi.mock('../store/keys', () => ({
	extensionsStoreKey: 'extensions',
	servicesStoreKey: 'services',
}));

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn((key: string) => {
			if (key === 'services') {
				return mockServicesStore;
			}

			return mockExtensionsStore;
		}),
	})),
	useFlashMessage: vi.fn(() => mockFlashMessage),
}));

describe('useExtensionActions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('toggleEnabled', () => {
		it('should enable extension successfully', async () => {
			mockExtensionsStore.update.mockResolvedValue({ type: 'test-module', enabled: true });

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(true);
			expect(mockExtensionsStore.update).toHaveBeenCalledWith({
				type: 'test-module',
				data: { enabled: true },
			});
			expect(mockFlashMessage.success).toHaveBeenCalledWith('extensionsModule.messages.extensionEnabled');
		});

		it('should disable extension successfully', async () => {
			mockExtensionsStore.update.mockResolvedValue({ type: 'test-module', enabled: false });

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', false);

			expect(result).toBe(true);
			expect(mockExtensionsStore.update).toHaveBeenCalledWith({
				type: 'test-module',
				data: { enabled: false },
			});
			expect(mockFlashMessage.success).toHaveBeenCalledWith('extensionsModule.messages.extensionDisabled');
		});

		it('should show error message on API error with code 400', async () => {
			mockExtensionsStore.update.mockRejectedValue(new ExtensionsApiException('Not configurable', 400));

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(false);
			expect(mockFlashMessage.error).toHaveBeenCalledWith('extensionsModule.messages.notConfigurableError');
		});

		it('should show generic error message on other API errors', async () => {
			mockExtensionsStore.update.mockRejectedValue(new ExtensionsApiException('Server error', 500));

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(false);
			expect(mockFlashMessage.error).toHaveBeenCalledWith('extensionsModule.messages.updateError');
		});

		it('should show generic error message on unknown errors', async () => {
			mockExtensionsStore.update.mockRejectedValue(new Error('Unknown error'));

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(false);
			expect(mockFlashMessage.error).toHaveBeenCalledWith('extensionsModule.messages.updateError');
		});
	});
});
