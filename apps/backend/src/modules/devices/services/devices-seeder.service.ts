import { ClassConstructor } from 'class-transformer';
import inquirer from 'inquirer';
import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { BaseEntity } from '../../../common/entities/base.entity';
import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { CreateChannelControlDto } from '../dto/create-channel-control.dto';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { CreateDeviceControlDto } from '../dto/create-device-control.dto';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { ChannelTypeMapping, ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsControlsService } from './channels.controls.service';
import {
	ChannelPropertyTypeMapping,
	ChannelsPropertiesTypeMapperService,
} from './channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceTypeMapping, DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesControlsService } from './devices.controls.service';
import { DevicesService } from './devices.service';

// Default seed file names
const DEFAULT_DEVICES_FILE = 'devices.json';
const DEFAULT_DEVICES_CONTROLS_FILE = 'devices_controls.json';
const DEFAULT_CHANNELS_FILE = 'channels.json';
const DEFAULT_CHANNELS_CONTROLS_FILE = 'channels_controls.json';
const DEFAULT_CHANNELS_PROPERTIES_FILE = 'channels_properties.json';

@Injectable()
export class DevicesSeederService implements Seeder {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesSeederService');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesControlsService: DevicesControlsService,
		private readonly channelsService: ChannelsService,
		private readonly channelsControlService: ChannelsControlsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
		private readonly channelsMapperService: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapperService: ChannelsPropertiesTypeMapperService,
		private readonly seedTools: SeedTools,
	) {}

	async seed(): Promise<void> {
		const { seed } = await inquirer.prompt<{ seed: boolean }>([
			{
				type: 'confirm',
				name: 'seed',
				message: 'Would you like to seed the database with demo data for the Devices module?',
				default: true,
			},
		]);

		if (!seed) {
			this.logger.log('[SEED] Skipping Devices module.');

			return;
		}

		this.logger.log('[SEED] Seeding devices module...');

		let seededDevices = 0;
		let seededChannels = 0;

		const devices = this.seedTools.loadJsonData(DEFAULT_DEVICES_FILE);
		const devicesControls = this.seedTools.loadJsonData(DEFAULT_DEVICES_CONTROLS_FILE);
		const channels = this.seedTools.loadJsonData(DEFAULT_CHANNELS_FILE);
		const channelsControls = this.seedTools.loadJsonData(DEFAULT_CHANNELS_CONTROLS_FILE);
		const channelsProperties = this.seedTools.loadJsonData(DEFAULT_CHANNELS_PROPERTIES_FILE);

		if (!devices.length) {
			this.logger.warn('[SEED] No devices found in devices.json');
			return;
		}

		for (const device of devices) {
			try {
				await this.createDevice(device);

				seededDevices++;
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create device: ${JSON.stringify(device)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}

		// Process related entities
		await this.seedRelatedEntities(
			devicesControls,
			this.devicesControlsService,
			CreateDeviceControlDto,
			'device',
			'Device Control',
		);

		if (channels.length) {
			for (const channel of channels) {
				try {
					await this.createChannel(channel);
					seededChannels++;
				} catch (error) {
					const err = error as Error;

					this.logger.error(
						`[SEED] Failed to create channel: ${JSON.stringify(channel)} error=${err.message}`,
						err.stack,
					);
				}
			}

			// Process related entities
			await this.seedRelatedEntities(
				channelsControls,
				this.channelsControlService,
				CreateChannelControlDto,
				'channel',
				'Channel Control',
			);

			for (const channelProperty of channelsProperties) {
				const channelId = channelProperty['channel'] as string | undefined;

				if (typeof channelId !== 'string' || !uuidValidate(channelId)) {
					this.logger.error(`[SEED] Channel property relation channel=${channelId} is not a valid UUIDv4`);

					continue;
				}

				try {
					await this.createChannelProperty(channelId, channelProperty);
					seededChannels++;
				} catch (error) {
					const err = error as Error;

					this.logger.error(
						`[SEED] Failed to create channel property: ${JSON.stringify(channelProperty)} error=${err.message}`,
						err.stack,
					);
				}
			}
		}

		this.logger.log(`[SEED] Successfully seeded ${seededDevices} devices and ${seededChannels} channels.`);
	}

	private async createDevice(device: Record<string, any>) {
		if (!('type' in device) || typeof device.type !== 'string') {
			this.logger.error('[SEED] Device definition is missing type definition');

			return;
		}

		let mapping: DeviceTypeMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>;

		try {
			mapping = this.devicesMapperService.getMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>(device.type);
		} catch {
			this.logger.error(`[SEED] Unknown device type: ${device.type}`);

			return;
		}

		const dtoInstance = toInstance(mapping.createDto, device);

		await this.devicesService.create(dtoInstance);
	}

	private async createChannel(channel: Record<string, any>) {
		if (!('type' in channel) || typeof channel.type !== 'string') {
			this.logger.error('[SEED] Channel definition is missing type definition');

			return;
		}

		let mapping: ChannelTypeMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>;

		try {
			mapping = this.channelsMapperService.getMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>(channel.type);
		} catch {
			this.logger.error(`[SEED] Unknown channel type: ${channel.type}`);

			return;
		}

		const dtoInstance = toInstance(mapping.createDto, channel);

		await this.channelsService.create(dtoInstance);
	}

	private async createChannelProperty(channelId: ChannelEntity['id'], property: Record<string, any>) {
		if (!('type' in property) || typeof property.type !== 'string') {
			this.logger.error('[SEED] Channel definition is missing type definition');

			return;
		}

		let mapping: ChannelPropertyTypeMapping<ChannelPropertyEntity, CreateChannelPropertyDto, UpdateChannelPropertyDto>;

		try {
			mapping = this.channelsPropertiesMapperService.getMapping<
				ChannelPropertyEntity,
				CreateChannelPropertyDto,
				UpdateChannelPropertyDto
			>(property.type);
		} catch {
			this.logger.error(`[SEED] Unknown channel property type: ${property.type}`);

			return;
		}

		const dtoInstance = toInstance(mapping.createDto, property);

		await this.channelsPropertiesService.create(channelId, dtoInstance);
	}

	private async seedRelatedEntities<
		TData extends Record<string, any>,
		TEntity extends BaseEntity,
		TService extends { create: (relationId: string, dto: TDto) => Promise<TEntity> },
		TDto,
	>(
		dataArray: TData[],
		service: TService,
		dto: ClassConstructor<TDto>,
		relationKey: keyof TData,
		entityName: string,
	): Promise<void> {
		for (const item of dataArray) {
			const relationId = item[relationKey];

			if (!uuidValidate(relationId)) {
				this.logger.error(`[SEED] ${entityName} relation ${String(relationKey)} is not a valid UUIDv4`);

				continue;
			}

			const dtoInstance = toInstance(dto, item);

			try {
				await service.create(relationId, dtoInstance);
			} catch (error) {
				const err = error as Error;

				this.logger.error(
					`[SEED] Failed to create ${entityName}: ${JSON.stringify(item)} error=${err.message}`,
					err.stack,
				);
			}
		}
	}
}
