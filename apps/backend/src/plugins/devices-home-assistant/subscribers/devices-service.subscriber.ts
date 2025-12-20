import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, ConnectionState, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelSpecModel } from '../../../modules/devices/models/devices.model';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { channelsSchema } from '../../../spec/channels';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { CreateHomeAssistantChannelDto } from '../dto/create-channel.dto';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';
import { HomeAssistantWsService } from '../services/home-assistant.ws.service';

@Injectable()
export class DevicesServiceSubscriber {
	private readonly logger = new Logger(DevicesServiceSubscriber.name);

	private readonly CONNECTION_TYPE_MAP: Record<string, 'wired' | 'wifi' | 'zigbee' | 'bluetooth'> = {
		mac: 'wifi',
		ethernet: 'wired',
		zigbee: 'zigbee',
		bluetooth: 'bluetooth',
	};

	constructor(
		private readonly homeAssistantWsService: HomeAssistantWsService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
	) {}

	async onDeviceCreated(device: HomeAssistantDeviceEntity) {
		if (!device.haDeviceId) {
			return device;
		}

		const devicesRegistry = await this.homeAssistantWsService.getDevicesRegistry();

		const haDevice = devicesRegistry.find((d) => d.id === device.haDeviceId);

		if (!haDevice) {
			this.logger.warn('Home Assistant device was not found in the Home Assistant instance');

			return device;
		}

		const connectionTypeRaw = haDevice.connections.length ? haDevice.connections[0][0] : null;

		const connectionType =
			connectionTypeRaw && connectionTypeRaw in this.CONNECTION_TYPE_MAP
				? this.CONNECTION_TYPE_MAP[connectionTypeRaw]
				: null;

		const haDeviceInformationProperties = {
			[PropertyCategory.MANUFACTURER]: haDevice.manufacturer,
			[PropertyCategory.MODEL]: haDevice.model,
			[PropertyCategory.SERIAL_NUMBER]: haDevice.serialNumber || 'N/A',
			[PropertyCategory.FIRMWARE_REVISION]: haDevice.swVersion,
			[PropertyCategory.HARDWARE_REVISION]: haDevice.hwVersion,
			[PropertyCategory.CONNECTION_TYPE]: connectionType,
			[PropertyCategory.STATUS]: ConnectionState.UNKNOWN,
		};

		const rawSchema = channelsSchema[ChannelCategory.DEVICE_INFORMATION] as object | undefined;

		if (!rawSchema || typeof rawSchema !== 'object') {
			this.logger.warn(`Missing or invalid schema for channel category ${ChannelCategory.DEVICE_INFORMATION}`);

			return device;
		}

		const categorySpec = toInstance(
			ChannelSpecModel,
			{
				...rawSchema,
				properties: 'properties' in rawSchema && rawSchema.properties ? Object.values(rawSchema.properties) : [],
			},
			{
				excludeExtraneousValues: false,
			},
		);

		const errors = await validate(categorySpec);

		if (errors.length) {
			this.logger.error(
				`Home Assistant device create hook channel spec validation failed error=${JSON.stringify(errors)}`,
			);

			return device;
		}

		const createChannelDto = toInstance(CreateHomeAssistantChannelDto, {
			device: device.id,
			type: DEVICES_HOME_ASSISTANT_TYPE,
			category: ChannelCategory.DEVICE_INFORMATION,
			name: 'Device information',
			properties: Object.entries(haDeviceInformationProperties)
				.filter(([, value]) => value != null)
				.map(([category, value]: [PropertyCategory, string]) => {
					const spec = categorySpec.properties.find((p) => p.category === category);

					if (!spec) {
						return null;
					}

					return {
						type: DEVICES_HOME_ASSISTANT_TYPE,
						category,
						permissions: spec.permissions,
						data_type: spec.data_type,
						unit: spec.unit,
						format: spec.format,
						invalid: spec.invalid,
						step: spec.step,
						value: String(value),
						ha_entity_id: null,
						ha_attribute: null,
					};
				})
				.filter((prop) => prop !== null),
		});

		await this.channelsService.create(createChannelDto);

		return await this.devicesService.findOne<HomeAssistantDeviceEntity>(device.id, DEVICES_HOME_ASSISTANT_TYPE);
	}
}
