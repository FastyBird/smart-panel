import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';

import { useChannelIcon } from './useChannelIcon';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useChannelIcon', () => {
	const channelId = 'channel-1';

	let findById: Mock;
	let mockStore: {
		$id: string;
		findById: Mock;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		findById = vi.fn();

		mockStore = {
			$id: 'channels',
			findById,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns default icon if no category is found', () => {
		findById.mockReturnValue({ id: channelId });

		const { icon } = useChannelIcon(channelId);

		expect(icon.value).toBe('mdi:chip');
	});

	it('returns default icon if channel is null', () => {
		findById.mockReturnValue(null);

		const { icon } = useChannelIcon(channelId);

		expect(icon.value).toBe('mdi:chip');
	});

	it('returns default icon for unknown category', () => {
		findById.mockReturnValue({ id: channelId, category: 'unknown' });

		const { icon } = useChannelIcon(channelId);

		expect(icon.value).toBe('mdi:chip');
	});
});
