import { describe, expect, it, vi } from 'vitest';

import { DashboardException } from '../dashboard.exceptions';

import { usePagesActions } from './usePagesActions';

const mockPage = { id: '2', title: 'My Page' };

const mockFindById = vi.fn((id: string) => {
	if (id === '1') return null;
	if (id === '2') return mockPage;
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

describe('usePagesActions', () => {
	it('throws error if page is not found', async () => {
		const { remove } = usePagesActions();

		await expect(remove('1')).rejects.toThrow(DashboardException);
	});

	it('calls remove when confirmed', async () => {
		const { remove } = usePagesActions();

		await remove('2');

		expect(mockRemove).toHaveBeenCalledWith({ id: '2' });
	});
});
