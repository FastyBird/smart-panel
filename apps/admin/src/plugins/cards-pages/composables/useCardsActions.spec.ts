import { describe, expect, it, vi } from 'vitest';

import { DashboardException } from '../../../modules/dashboard';

import { useCardsActions } from './useCardsActions';

const mockCard = { id: '2', name: 'My Card' };

const mockFindById = vi.fn((id: string) => {
	if (id === '1') return null;
	if (id === '2') return mockCard;
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

describe('useCardsActions', () => {
	it('throws error if card is not found', async () => {
		const { remove } = useCardsActions();

		await expect(remove('1')).rejects.toThrow(DashboardException);
	});

	it('calls remove when confirmed', async () => {
		const { remove } = useCardsActions();

		await remove('2');

		expect(mockRemove).toHaveBeenCalledWith({ id: '2' });
	});
});
