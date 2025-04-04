import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';

import { useDeviceIcon } from './useDeviceIcon';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDeviceIcon', () => {
	const deviceId = 'device-1';

	let findById: Mock;
	let mockStore: {
		$id: string;
		findById: Mock;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		findById = vi.fn();

		mockStore = {
			$id: 'devices',
			findById,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns default icon if no category is found', () => {
		findById.mockReturnValue({ id: deviceId });

		const { icon } = useDeviceIcon({ id: deviceId });

		expect(icon.value).toBe('mdi:power-plug');
	});

	it('returns default icon if device is null', () => {
		findById.mockReturnValue(null);

		const { icon } = useDeviceIcon({ id: deviceId });

		expect(icon.value).toBe('mdi:power-plug');
	});

	it('returns default icon for unknown category', () => {
		findById.mockReturnValue({ id: deviceId, category: 'unknown' });

		const { icon } = useDeviceIcon({ id: deviceId });

		expect(icon.value).toBe('mdi:power-plug');
	});
});
