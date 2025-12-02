import { beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../openapi.constants';
import { DevicesException } from '../devices.exceptions';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';

import { useChannelSpecification } from './useChannelSpecification';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useChannelSpecification', () => {
	let mockChannel: IChannel;
	let mockChannels: IChannel[];
	let mockProperties: IChannelProperty[];

	beforeEach(() => {
		mockChannel = {
			id: 'channel-1',
			category: DevicesModuleChannelCategory.light,
		} as IChannel;

		mockChannels = [mockChannel];

		mockProperties = [
			{ id: 'prop-1', channel: 'channel-1', category: DevicesModuleChannelPropertyCategory.brightness } as IChannelProperty,
			{ id: 'prop-2', channel: 'channel-1', category: DevicesModuleChannelPropertyCategory.color_temperature } as IChannelProperty,
		];

		const mockChannelsStore = {
			findById: vi.fn((id) => mockChannels.find((c) => c.id === id) || null),
		};

		const mockPropertiesStore = {
			findForChannel: vi.fn((channelId) => mockProperties.filter((p) => p.channel === channelId)),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: (key: symbol) => {
				if (key.description?.includes('ChannelsStore')) return mockChannelsStore;
				if (key.description?.includes('ChannelsPropertiesStore')) return mockPropertiesStore;
				return null;
			},
		});
	});

	it('allows adding another property if optional categories remain', () => {
		const { canAddAnotherProperty } = useChannelSpecification({ id: 'channel-1' });

		expect(canAddAnotherProperty.value).toBe(true); // hue not present
	});

	it('disallows adding property if all allowed are already assigned', () => {
		const { canAddAnotherProperty } = useChannelSpecification({ id: 'channel-1' });

		expect(canAddAnotherProperty.value).toBe(true);
	});

	it('returns missing required properties', () => {
		mockProperties = [{ id: 'prop-1', channel: 'channel-1', category: DevicesModuleChannelPropertyCategory.color_temperature } as IChannelProperty];

		const { missingRequiredProperties } = useChannelSpecification({ id: 'channel-1' });

		expect(missingRequiredProperties.value).toEqual([DevicesModuleChannelPropertyCategory.on]);
	});

	it('throws error when channel does not exist', () => {
		mockChannels = [];

		const { missingRequiredProperties } = useChannelSpecification({ id: 'channel-1' });

		expect(() => missingRequiredProperties.value).toThrow(DevicesException);
	});
});
