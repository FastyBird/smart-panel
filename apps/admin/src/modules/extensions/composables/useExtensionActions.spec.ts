import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionsApiException } from '../extensions.exceptions';

import { useExtensionActions } from './useExtensionActions';

const mockStore = {
	update: vi.fn(),
};

const mockFlashMessage = {
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warning: vi.fn(),
};

vi.mock('vue-i18n', () => ({
	useI18n: vi.fn(() => ({
		t: (key: string) => key,
	})),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => mockStore),
	})),
	useFlashMessage: vi.fn(() => mockFlashMessage),
}));

describe('useExtensionActions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('toggleEnabled', () => {
		it('should enable extension successfully', async () => {
			mockStore.update.mockResolvedValue({ type: 'test-module', enabled: true });

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(true);
			expect(mockStore.update).toHaveBeenCalledWith({
				type: 'test-module',
				data: { enabled: true },
			});
			expect(mockFlashMessage.success).toHaveBeenCalledWith('extensionsModule.messages.extensionEnabled');
		});

		it('should disable extension successfully', async () => {
			mockStore.update.mockResolvedValue({ type: 'test-module', enabled: false });

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', false);

			expect(result).toBe(true);
			expect(mockStore.update).toHaveBeenCalledWith({
				type: 'test-module',
				data: { enabled: false },
			});
			expect(mockFlashMessage.success).toHaveBeenCalledWith('extensionsModule.messages.extensionDisabled');
		});

		it('should show error message on API error with code 400', async () => {
			mockStore.update.mockRejectedValue(new ExtensionsApiException('Not configurable', 400));

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(false);
			expect(mockFlashMessage.error).toHaveBeenCalledWith('extensionsModule.messages.notConfigurableError');
		});

		it('should show generic error message on other API errors', async () => {
			mockStore.update.mockRejectedValue(new ExtensionsApiException('Server error', 500));

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(false);
			expect(mockFlashMessage.error).toHaveBeenCalledWith('extensionsModule.messages.updateError');
		});

		it('should show generic error message on unknown errors', async () => {
			mockStore.update.mockRejectedValue(new Error('Unknown error'));

			const { toggleEnabled } = useExtensionActions();

			const result = await toggleEnabled('test-module', true);

			expect(result).toBe(false);
			expect(mockFlashMessage.error).toHaveBeenCalledWith('extensionsModule.messages.updateError');
		});
	});
});
