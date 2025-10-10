import { describe, expect, it, vi } from 'vitest';

import { DevicesException } from '../devices.exceptions';

import { useChannelsPropertiesActions } from './useChannelsPropertiesActions';

const mockProperty = { id: '2', channel: 'chan', name: 'My Property' };

const mockFindById = vi.fn((id: string) => {
	if (id === '1') return null;
	if (id === '2') return mockProperty;
	return null;
});

const mockRemove = vi.fn();

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElMessageBox: {
			confirm: vi.fn().mockResolvedValue(undefined),
		},
	};
});

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
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
	};
});

describe('useChannelsPropertiesActions', () => {
	it('throws error if property is not found', async () => {
		const { remove } = useChannelsPropertiesActions();

		await expect(remove('1')).rejects.toThrow(DevicesException);
	});

	it('calls remove when confirmed', async () => {
		const { remove } = useChannelsPropertiesActions();

		await remove('2');

		expect(mockRemove).toHaveBeenCalledWith({ id: '2', channelId: 'chan' });
	});
});
