import { ClassConstructor, plainToInstance } from 'class-transformer';
import inquirer from 'inquirer';
import { validate as uuidValidate } from 'uuid';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { BaseEntity } from '../../../common/entities/base.entity';
import { getEnvValue } from '../../../common/utils/config.utils';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { CreateChannelControlDto } from '../dto/create-channel-control.dto';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { CreateDeviceControlDto } from '../dto/create-device-control.dto';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

import { ChannelsControlsService } from './channels.controls.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceTypeMapping, DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesControlsService } from './devices.controls.service';
import { DevicesService } from './devices.service';

@Injectable()
export class DevicesSeederService implements Seeder {
	private readonly logger = new Logger(DevicesSeederService.name);

	constructor(
		private readonly configService: NestConfigService,
		private readonly devicesService: DevicesService,
		private readonly devicesControlsService: DevicesControlsService,
		private readonly channelsService: ChannelsService,
		private readonly channelsControlService: ChannelsControlsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
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

		const devices = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_DEVICES_FILE', 'devices.json'),
		);
		const devicesControls = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_DEVICES_CONTROLS_FILE', 'devices_controls.json'),
		);
		const channels = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_CHANNELS_FILE', 'channels.json'),
		);
		const channelsControls = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_CHANNELS_CONTROLS_FILE', 'channels_controls.json'),
		);
		const channelsProperties = this.seedTools.loadJsonData(
			getEnvValue<string>(this.configService, 'FB_SEED_CHANNELS_PROPERTIES_FILE', 'channels_properties.json'),
		);

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
			await this.seedRelatedEntities(
				channelsProperties,
				this.channelsPropertiesService,
				CreateChannelPropertyDto,
				'channel',
				'Channel Property',
			);
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

		const dtoInstance = plainToInstance(mapping.createDto, device, { excludeExtraneousValues: true });

		await this.devicesService.create(dtoInstance);
	}

	private async createChannel(channel: Record<string, any>) {
		const dtoInstance = plainToInstance(CreateChannelDto, channel, { excludeExtraneousValues: true });

		await this.channelsService.create(dtoInstance);
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

			const dtoInstance = plainToInstance(dto, item, { excludeExtraneousValues: true });

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
