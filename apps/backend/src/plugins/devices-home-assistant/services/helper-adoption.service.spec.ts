import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { BUILTIN_TRANSFORMERS, TransformerRegistry } from '../mappings/transformers/transformer.registry';

import { HelperAdoptionService } from './helper-adoption.service';
import { HomeAssistantHttpService } from './home-assistant.http.service';

describe('HelperAdoptionService', () => {
	it('applies the configured transformer while syncing a discovered helper state', async () => {
		const getState = jest.fn();
		const update = jest.fn().mockResolvedValue(undefined);
		const panelDevice = Object.assign(new HomeAssistantDeviceEntity(), { id: 'device-1' });
		const channel = Object.assign(new HomeAssistantChannelEntity(), { device: panelDevice });
		const property = Object.assign(new HomeAssistantChannelPropertyEntity(), {
			id: 'property-1',
			category: PropertyCategory.BRIGHTNESS,
			dataType: DataTypeType.UCHAR,
			haEntityId: 'light.desk',
			haAttribute: 'brightness',
			haTransformer: 'brightness_to_percent',
			channel,
		});
		const transformerRegistry = new TransformerRegistry();
		transformerRegistry.registerAll(BUILTIN_TRANSFORMERS);
		const service = new HelperAdoptionService(
			{ getState } as unknown as HomeAssistantHttpService,
			{} as DevicesService,
			{} as ChannelsService,
			{ findAll: jest.fn().mockResolvedValue([property]), update } as unknown as ChannelsPropertiesService,
			{} as DeviceConnectivityService,
			{} as DeviceValidationService,
			transformerRegistry,
		);

		await service['syncHelperState']('device-1', 'light.desk', {
			entityId: 'light.desk',
			state: 'on',
			attributes: { brightness: 255 },
			lastChanged: new Date(),
			lastReported: new Date(),
			lastUpdated: new Date(),
		});

		expect(getState).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledWith('property-1', expect.objectContaining({ value: 100 }));
	});
});
