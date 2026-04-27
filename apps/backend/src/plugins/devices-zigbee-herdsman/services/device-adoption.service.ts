import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	DEVICES_ZIGBEE_HERDSMAN_TYPE,
	ZH_DEVICE_INFO_PROPERTY_IDENTIFIERS,
	formatSnakeCaseToTitle,
} from '../devices-zigbee-herdsman.constants';
import {
	DevicesZigbeeHerdsmanException,
	DevicesZigbeeHerdsmanNotFoundException,
	DevicesZigbeeHerdsmanValidationException,
} from '../devices-zigbee-herdsman.exceptions';
import { CreateZigbeeHerdsmanChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateZigbeeHerdsmanChannelDto } from '../dto/create-channel.dto';
import { CreateZigbeeHerdsmanDeviceDto } from '../dto/create-device.dto';
import { ZhAdoptDeviceRequestDto } from '../dto/mapping-preview.dto';
import {
	ZigbeeHerdsmanChannelEntity,
	ZigbeeHerdsmanChannelPropertyEntity,
	ZigbeeHerdsmanDeviceEntity,
} from '../entities/devices-zigbee-herdsman.entity';
import { ZhDiscoveredDevice } from '../interfaces/zigbee-herdsman.interface';

import { ZigbeeHerdsmanService } from './zigbee-herdsman.service';

@Injectable()
export class ZhDeviceAdoptionService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'DeviceAdoptionService',
	);

	constructor(
		private readonly zigbeeHerdsmanService: ZigbeeHerdsmanService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly dataSource: DataSource,
	) {}

	async adoptDevice(request: ZhAdoptDeviceRequestDto): Promise<ZigbeeHerdsmanDeviceEntity> {
		this.logger.debug(`Adopting device ieeeAddress=${request.ieeeAddress}`);

		// Verify coordinator is online — don't adopt from stale cached data
		if (!this.zigbeeHerdsmanService.isCoordinatorOnline()) {
			throw new DevicesZigbeeHerdsmanValidationException('Cannot adopt device: Zigbee coordinator is offline');
		}

		// Verify device exists on network
		const discovered = this.zigbeeHerdsmanService.getDiscoveredDevice(request.ieeeAddress);
		if (!discovered) {
			throw new DevicesZigbeeHerdsmanNotFoundException(`Device ${request.ieeeAddress} not found on Zigbee network`);
		}

		// Check if already adopted — remove existing if re-adopting
		const existingDevices = await this.devicesService.findAll<ZigbeeHerdsmanDeviceEntity>(DEVICES_ZIGBEE_HERDSMAN_TYPE);
		const existing = existingDevices.find((d) => d.ieeeAddress === request.ieeeAddress);
		if (existing) {
			this.logger.debug(`Removing existing device ${existing.id} for re-adoption`);
			await this.devicesService.remove(existing.id);
		}

		// Create device via DTO
		const createDeviceDto = toInstance(CreateZigbeeHerdsmanDeviceDto, {
			type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			identifier: request.ieeeAddress,
			name: request.name,
			category: request.category,
			description: request.description || null,
			enabled: request.enabled ?? true,
		});

		const device = await this.devicesService.create<ZigbeeHerdsmanDeviceEntity, CreateZigbeeHerdsmanDeviceDto>(
			createDeviceDto,
		);

		try {
			// Persist Zigbee-specific columns via TypeORM (not part of the base create DTO)
			const repo = this.dataSource.getRepository(ZigbeeHerdsmanDeviceEntity);
			await repo.update(device.id, {
				ieeeAddress: request.ieeeAddress,
				networkAddress: discovered.networkAddress,
				manufacturerName: discovered.manufacturerName,
				modelId: discovered.modelId,
				dateCode: discovered.dateCode,
				softwareBuildId: discovered.softwareBuildId,
				interviewCompleted: discovered.interviewStatus === 'completed',
			});

			// Set initial connection state
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: discovered.available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			});

			// Create device information channel
			await this.createDeviceInfoChannel(device, discovered);

			// Create user-defined channels from request
			for (const channelDef of request.channels) {
				if (channelDef.category === ChannelCategory.DEVICE_INFORMATION) {
					continue;
				}
				await this.createChannel(device, channelDef);
			}

			// Return the fully loaded device
			const fullDevice = await this.devicesService.findOne<ZigbeeHerdsmanDeviceEntity>(
				device.id,
				DEVICES_ZIGBEE_HERDSMAN_TYPE,
			);
			if (!fullDevice) {
				throw new DevicesZigbeeHerdsmanException('Failed to load adopted device');
			}

			this.logger.debug(`Device adopted: ${fullDevice.id} (${fullDevice.name})`);
			return fullDevice;
		} catch (error) {
			// Cleanup on failure
			this.logger.error(
				`Failed to create channels, cleaning up device: ${device.id}`,
				error instanceof Error ? error : String(error),
			);
			try {
				await this.devicesService.remove(device.id);
			} catch (cleanupError) {
				this.logger.error(
					`Failed to cleanup device: ${device.id}`,
					cleanupError instanceof Error ? cleanupError : String(cleanupError),
				);
			}

			if (
				error instanceof DevicesZigbeeHerdsmanException ||
				error instanceof DevicesZigbeeHerdsmanNotFoundException ||
				error instanceof DevicesZigbeeHerdsmanValidationException
			) {
				throw error;
			}

			const err = error as Error;
			throw new DevicesZigbeeHerdsmanException(`Failed to adopt device: ${err.message}`);
		}
	}

	private async createDeviceInfoChannel(
		device: ZigbeeHerdsmanDeviceEntity,
		discovered: ZhDiscoveredDevice,
	): Promise<void> {
		const createChannelDto = toInstance(CreateZigbeeHerdsmanChannelDto, {
			device: device.id,
			type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			identifier: 'device_information',
			name: 'Device Information',
			category: ChannelCategory.DEVICE_INFORMATION,
		});

		const channel = await this.channelsService.create<ZigbeeHerdsmanChannelEntity, CreateZigbeeHerdsmanChannelDto>(
			createChannelDto,
		);

		const infoProperties = [
			{
				identifier: ZH_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
				name: 'Manufacturer',
				category: PropertyCategory.MANUFACTURER,
				value: discovered.definition?.vendor ?? discovered.manufacturerName ?? 'Unknown',
			},
			{
				identifier: ZH_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
				name: 'Model',
				category: PropertyCategory.MODEL,
				value: discovered.definition?.model ?? discovered.modelId ?? 'Unknown',
			},
			{
				identifier: ZH_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
				name: 'Serial Number',
				category: PropertyCategory.SERIAL_NUMBER,
				value: discovered.ieeeAddress,
			},
		];

		for (const info of infoProperties) {
			const createPropertyDto = toInstance(CreateZigbeeHerdsmanChannelPropertyDto, {
				type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
				identifier: info.identifier,
				name: info.name,
				category: info.category,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
				unit: null,
				format: null,
				invalid: null,
				step: null,
				value: info.value,
			});

			await this.channelsPropertiesService.create<
				ZigbeeHerdsmanChannelPropertyEntity,
				CreateZigbeeHerdsmanChannelPropertyDto
			>(channel.id, createPropertyDto);
		}
	}

	private async createChannel(
		device: ZigbeeHerdsmanDeviceEntity,
		channelDef: ZhAdoptDeviceRequestDto['channels'][0],
	): Promise<void> {
		const createChannelDto = toInstance(CreateZigbeeHerdsmanChannelDto, {
			device: device.id,
			type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			identifier: channelDef.identifier ?? channelDef.category,
			name: channelDef.name,
			category: channelDef.category,
		});

		const channel = await this.channelsService.create<ZigbeeHerdsmanChannelEntity, CreateZigbeeHerdsmanChannelDto>(
			createChannelDto,
		);

		for (const propDef of channelDef.properties) {
			const createPropertyDto = toInstance(CreateZigbeeHerdsmanChannelPropertyDto, {
				type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
				identifier: propDef.zigbeeProperty,
				name: formatSnakeCaseToTitle(propDef.zigbeeProperty),
				category: propDef.category,
				data_type: propDef.dataType,
				permissions: propDef.permissions,
				unit: null,
				format: propDef.format ?? null,
				invalid: null,
				step: null,
				value: null,
			});

			await this.channelsPropertiesService.create<
				ZigbeeHerdsmanChannelPropertyEntity,
				CreateZigbeeHerdsmanChannelPropertyDto
			>(channel.id, createPropertyDto);
		}
	}
}
