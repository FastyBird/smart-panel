import { describe, expect, it, vi } from 'vitest';

import { DevicesException } from '../devices.exceptions';

import { useDevicesActions } from './useDevicesActions';

const mockDevice = { id: '2', name: 'My Device' };

const mockFindById = vi.fn((id: string) => {
	if (id === '1') return null;
	if (id === '2') return mockDevice;
	return null;
});

const mockRemove = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

vi.mock('element-plus', () => ({
	ElMessageBox: {
		confirm: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			findById: mockFindById,
			remove: mockRemove,
		}),
	}),
	useFlashMessage: () => ({
		success: mockSuccess,
		error: mockError,
		info: mockInfo,
	}),
}));

describe('useDevicesActions', () => {
	it('throws error if device is not found', async () => {
		const { remove } = useDevicesActions();

		await expect(remove('1')).rejects.toThrow(DevicesException);
	});

	it('calls remove when confirmed', async () => {
		const { remove } = useDevicesActions();

		await remove('2');

		expect(mockRemove).toHaveBeenCalledWith({ id: '2' });
	});
});
