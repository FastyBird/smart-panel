import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';
import { MappingLoaderService } from '../mappings';
import { HomeAssistantDiscoveredHelperModel, HomeAssistantStateModel } from '../models/home-assistant.model';

import { HelperMappingPreviewService } from './helper-mapping-preview.service';
import { HomeAssistantHttpService } from './home-assistant.http.service';

describe('HelperMappingPreviewService', () => {
	it('carries mapping transformers into helper property previews', async () => {
		const mappingLoaderService = {
			findMatchingMapping: jest.fn().mockReturnValue({
				channel: { category: ChannelCategory.LIGHT },
				deviceCategory: DeviceCategory.LIGHTING,
				propertyBindings: [
					{
						haAttribute: 'brightness',
						propertyCategory: PropertyCategory.BRIGHTNESS,
						transformerName: 'brightness_to_percent',
					},
				],
			}),
		};
		const service = new HelperMappingPreviewService(
			{} as HomeAssistantHttpService,
			mappingLoaderService as unknown as MappingLoaderService,
		);
		const state = Object.assign(new HomeAssistantStateModel(), {
			entityId: 'light.desk',
			state: 'on',
			attributes: { brightness: 128 },
			lastChanged: null,
			lastReported: null,
			lastUpdated: null,
		});
		const helper = Object.assign(new HomeAssistantDiscoveredHelperModel(), {
			entityId: 'light.desk',
			name: 'Desk light',
			domain: HomeAssistantDomain.LIGHT,
			adoptedDeviceId: null,
			state,
		});

		const previews = await service.generatePreviews([helper]);

		expect(previews[0].suggestedChannels[0].suggestedProperties[0].haTransformer).toBe('brightness_to_percent');
	});
});
