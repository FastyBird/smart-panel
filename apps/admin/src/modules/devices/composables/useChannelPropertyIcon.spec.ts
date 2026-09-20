import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelPropertyCategory } from '../../../openapi.constants';

import { useChannelPropertyIcon } from './useChannelPropertyIcon';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useChannelPropertyIcon', () => {
	const propertyId = 'property-1';

	let findById: Mock;
	let mockStore: {
		$id: string;
		findById: Mock;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		findById = vi.fn();

		mockStore = {
			$id: 'channel-properties',
			findById,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns default icon if no category is found', () => {
		findById.mockReturnValue({ id: propertyId });

		const { icon } = useChannelPropertyIcon({ id: propertyId });

		expect(icon.value).toBe('mdi:tune');
	});

	it('returns default icon if property is null', () => {
		findById.mockReturnValue(null);

		const { icon } = useChannelPropertyIcon({ id: propertyId });

		expect(icon.value).toBe('mdi:tune');
	});

	it('returns default icon for unknown category', () => {
		findById.mockReturnValue({ id: propertyId, category: 'unknown' });

		const { icon } = useChannelPropertyIcon({ id: propertyId });

		expect(icon.value).toBe('mdi:tune');
	});

	it('returns bell-ring-outline icon for event', () => {
		findById.mockReturnValue({ id: propertyId, category: DevicesModuleChannelPropertyCategory.event });

		const { icon } = useChannelPropertyIcon({ id: propertyId });

		expect(icon.value).toBe('mdi:bell-ring-outline');
	});

	it('returns record-circle-outline icon for detected', () => {
		findById.mockReturnValue({ id: propertyId, category: DevicesModuleChannelPropertyCategory.detected });

		const { icon } = useChannelPropertyIcon({ id: propertyId });

		expect(icon.value).toBe('mdi:record-circle-outline');
	});
});
