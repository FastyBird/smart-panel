import { ElMessageBox } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpaceRoomCategory, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import { useSpacesActions } from './useSpacesActions';

const createMockSpace = (overrides: Partial<ISpace> = {}): ISpace => ({
	id: 'space-1',
	name: 'Test Space',
	description: null,
	type: SpaceType.ROOM,
	category: SpaceRoomCategory.LIVING_ROOM,
	icon: null,
	displayOrder: 0,
	parentId: null,
	suggestionsEnabled: true,
	statusWidgets: null,
	createdAt: new Date(),
	updatedAt: null,
	draft: false,
	...overrides,
});

const mockSpace1 = createMockSpace({ id: 'space-1', name: 'Living Room' });
const mockSpace2 = createMockSpace({ id: 'space-2', name: 'Bedroom' });

const mockFindById = vi.fn((id: string) => {
	if (id === 'space-1') return mockSpace1;
	if (id === 'space-2') return mockSpace2;
	return null;
});

const mockRemove = vi.fn();
const mockBulkRemove = vi.fn();

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
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
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
				bulkRemove: mockBulkRemove,
			}),
		}),
		useFlashMessage: () => ({
			success: mockSuccess,
			error: mockError,
			info: mockInfo,
		}),
	};
});

describe('useSpacesActions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('remove', () => {
		it('returns false and shows error if space is not found', async () => {
			const { remove } = useSpacesActions();

			const result = await remove('nonexistent');

			expect(result).toBe(false);
			expect(mockError).toHaveBeenCalledWith('spacesModule.messages.notFound');
			expect(mockRemove).not.toHaveBeenCalled();
		});

		it('calls remove when confirmed', async () => {
			const { remove } = useSpacesActions();

			await remove('space-1');

			expect(mockRemove).toHaveBeenCalledWith({ id: 'space-1' });
		});

		it('shows success message after removing', async () => {
			const { remove } = useSpacesActions();

			await remove('space-1');

			expect(mockSuccess).toHaveBeenCalledWith(expect.stringContaining('spacesModule.messages.removed'));
		});
	});

	describe('bulkRemove', () => {
		beforeEach(() => {
			mockBulkRemove.mockResolvedValue({ succeeded: [], failed: [] });
		});

		it('does nothing when spaces array is empty', async () => {
			const { bulkRemove } = useSpacesActions();

			await bulkRemove([]);

			expect(mockBulkRemove).not.toHaveBeenCalled();
		});

		it('sends the whole selection in one call when confirmed', async () => {
			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockBulkRemove).toHaveBeenCalledTimes(1);
			expect(mockBulkRemove).toHaveBeenCalledWith({ ids: ['space-1', 'space-2'] });
		});

		it('does not call the store when the confirmation is cancelled', async () => {
			vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce(new Error('cancel'));

			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockBulkRemove).not.toHaveBeenCalled();
			expect(mockError).not.toHaveBeenCalled();
		});

		it('shows success message after bulk removing', async () => {
			mockBulkRemove.mockResolvedValue({ succeeded: ['space-1', 'space-2'], failed: [] });

			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockSuccess).toHaveBeenCalledWith(expect.stringContaining('spacesModule.messages.bulkRemoved'));
		});

		it('shows error message when some removes fail', async () => {
			mockBulkRemove.mockResolvedValue({ succeeded: ['space-1'], failed: [{ id: 'space-2', reason: 'Failed to remove' }] });

			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockSuccess).toHaveBeenCalled();
			expect(mockError).toHaveBeenCalledWith(expect.stringContaining('spacesModule.messages.bulkRemoveFailed'));
		});

		it('reports a failed request as failed rather than cancelled', async () => {
			mockBulkRemove.mockRejectedValue(new Error('Request failed'));

			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockError).toHaveBeenCalledWith(expect.stringContaining('spacesModule.messages.bulkRemoveFailed'));
			expect(mockInfo).not.toHaveBeenCalled();
		});
	});
});
