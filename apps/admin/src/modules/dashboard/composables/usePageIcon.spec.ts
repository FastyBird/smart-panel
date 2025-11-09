import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';

import { usePageIcon } from './usePageIcon';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('usePageIcon', () => {
	const pageId = 'page-1';

	let findById: Mock;
	let mockStore: {
		$id: string;
		findById: Mock;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		findById = vi.fn();

		mockStore = {
			$id: 'pages',
			findById,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns default icon for page without custom icon', () => {
		findById.mockReturnValue({ id: pageId });

		const { icon } = usePageIcon({ id: pageId });

		expect(icon.value).toBe('mdi:view-dashboard');
	});

	it('returns default icon if page is null', () => {
		findById.mockReturnValue(null);

		const { icon } = usePageIcon({ id: pageId });

		expect(icon.value).toBe('mdi:view-dashboard');
	});

	it('returns page cuctom icon', () => {
		findById.mockReturnValue({ id: pageId, icon: 'custom-icon' });

		const { icon } = usePageIcon({ id: pageId });

		expect(icon.value).toBe('mdi:custom-icon');
	});
});
