import { describe, expect, it, vi } from 'vitest';

import { DashboardException } from '../dashboard.exceptions';

import { useDataSourcesActions } from './useDataSourcesActions';

const mockDataSources = { id: '2', page: 'page-2' };

const mockFindById = vi.fn((_parent: string, id: string) => {
	if (id === '1') return null;
	if (id === '2') return mockDataSources;
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

describe('useDataSourcesActions', () => {
	it('throws error if data sources is not found', async () => {
		const { remove } = useDataSourcesActions({ parent: 'page', parentId: 'page-1' });

		await expect(remove('1')).rejects.toThrow(DashboardException);
	});

	it('calls remove when confirmed', async () => {
		const { remove } = useDataSourcesActions({ parent: 'page', parentId: 'page-2' });

		await remove('2');

		expect(mockRemove).toHaveBeenCalledWith({ id: '2', parent: { type: 'page', id: 'page-2' } });
	});
});
