import { createPinia, setActivePinia } from 'pinia';

import { ElMessageBox } from 'element-plus';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IWeatherLocation } from '../store/locations.store.types';

import { useLocationsActions } from './useLocationsActions';

const mockLocation: IWeatherLocation = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	type: 'weather-openweathermap',
	name: 'Home',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-15T10:30:00Z'),
	updatedAt: new Date('2025-01-16T14:20:00Z'),
};

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('element-plus', async (importOriginal) => {
	const actual = await importOriginal<typeof import('element-plus')>();

	return {
		...actual,
		ElMessageBox: {
			confirm: vi.fn(),
		},
	};
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(),
	};
});

describe('useLocationsActions', () => {
	let remove: Mock;
	let findById: Mock;
	let flashSuccess: Mock;
	let flashError: Mock;
	let flashInfo: Mock;

	let mockStore: {
		remove: Mock;
		findById: Mock;
		$id: string;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		remove = vi.fn().mockResolvedValue(true);
		findById = vi.fn();

		flashSuccess = vi.fn();
		flashError = vi.fn();
		flashInfo = vi.fn();

		mockStore = {
			remove,
			findById,
			$id: 'weather_module-locations',
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});

		(useFlashMessage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			success: flashSuccess,
			error: flashError,
			info: flashInfo,
		});

		vi.clearAllMocks();
	});

	it('should not call remove for non-existent location', async () => {
		findById.mockReturnValue(null);

		const { remove: removeAction } = useLocationsActions();

		await removeAction('non-existent');

		expect(ElMessageBox.confirm).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});

	it('should show confirmation dialog before removing', async () => {
		findById.mockReturnValue(mockLocation);
		(ElMessageBox.confirm as Mock).mockResolvedValue('confirm');

		const { remove: removeAction } = useLocationsActions();

		await removeAction(mockLocation.id);

		expect(ElMessageBox.confirm).toHaveBeenCalledWith(
			'weatherModule.messages.locations.confirmDeleteLocation',
			'weatherModule.headings.deleteLocation',
			expect.objectContaining({
				type: 'warning',
			})
		);
	});

	it('should call store.remove and show success message on confirm', async () => {
		findById.mockReturnValue(mockLocation);
		(ElMessageBox.confirm as Mock).mockResolvedValue('confirm');

		const { remove: removeAction } = useLocationsActions();

		await removeAction(mockLocation.id);

		// Wait for the promise chain to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(remove).toHaveBeenCalledWith({ id: mockLocation.id });
		expect(flashSuccess).toHaveBeenCalledWith('weatherModule.messages.locations.deleted');
	});

	it('should show error message on remove failure', async () => {
		findById.mockReturnValue(mockLocation);
		(ElMessageBox.confirm as Mock).mockResolvedValue('confirm');
		remove.mockRejectedValue(new Error('Delete failed'));

		const { remove: removeAction } = useLocationsActions();

		await removeAction(mockLocation.id);

		// Wait for the promise chain to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(flashError).toHaveBeenCalledWith('weatherModule.messages.locations.notDeleted');
	});

	it('should show info message on cancel', async () => {
		findById.mockReturnValue(mockLocation);
		(ElMessageBox.confirm as Mock).mockRejectedValue('cancel');

		const { remove: removeAction } = useLocationsActions();

		await removeAction(mockLocation.id);

		// Wait for the promise chain to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(flashInfo).toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});
});
