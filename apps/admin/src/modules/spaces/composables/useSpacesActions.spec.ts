import { describe, expect, it, vi } from 'vitest';

import { SpaceCategory, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import { useSpacesActions } from './useSpacesActions';

const createMockSpace = (overrides: Partial<ISpace> = {}): ISpace => ({
	id: 'space-1',
	name: 'Test Space',
	description: null,
	type: SpaceType.ROOM,
	category: SpaceCategory.LIVING_ROOM,
	icon: null,
	displayOrder: 0,
	parentId: null,
	primaryThermostatId: null,
	primaryTemperatureSensorId: null,
	suggestionsEnabled: true,
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
		it('does nothing when spaces array is empty', async () => {
			const { bulkRemove } = useSpacesActions();

			await bulkRemove([]);

			expect(mockRemove).not.toHaveBeenCalled();
		});

		it('calls remove for each space when confirmed', async () => {
			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockRemove).toHaveBeenCalledTimes(2);
			expect(mockRemove).toHaveBeenCalledWith({ id: 'space-1' });
			expect(mockRemove).toHaveBeenCalledWith({ id: 'space-2' });
		});

		it('shows success message after bulk removing', async () => {
			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockSuccess).toHaveBeenCalledWith(expect.stringContaining('spacesModule.messages.bulkRemoved'));
		});

		it('shows error message when some removes fail', async () => {
			mockRemove.mockImplementation(({ id }) => {
				if (id === 'space-2') {
					throw new Error('Failed to remove');
				}
			});

			const { bulkRemove } = useSpacesActions();

			await bulkRemove([mockSpace1, mockSpace2]);

			expect(mockSuccess).toHaveBeenCalled();
			expect(mockError).toHaveBeenCalledWith(expect.stringContaining('spacesModule.messages.bulkRemoveFailed'));
		});
	});
});
