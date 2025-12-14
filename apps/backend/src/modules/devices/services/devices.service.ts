import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType } from '../devices.constants';
import { DevicesException, DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { ChannelEntity, DeviceControlEntity, DeviceEntity } from '../entities/devices.entity';

import { ChannelsService } from './channels.service';
import { DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesControlsService } from './devices.controls.service';

@Injectable()
export class DevicesService {
	private readonly logger = new Logger(DevicesService.name);

	constructor(
		@InjectRepository(DeviceEntity)
		private readonly repository: Repository<DeviceEntity>,
		private readonly devicesMapperService: DevicesTypeMapperService,
		private readonly channelsService: ChannelsService,
		private readonly devicesControlsService: DevicesControlsService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getCount<TDevice extends DeviceEntity>(type?: string): Promise<number> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('[LOOKUP ALL] Fetching all devices count');

		const devices = await repository.count();

		this.logger.debug(`[LOOKUP ALL] Found that in system is ${devices} devices`);

		return devices;
	}

	// Devices
	async findAll<TDevice extends DeviceEntity>(type?: string): Promise<TDevice[]> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('[LOOKUP ALL] Fetching all devices');

		const devices = (await repository.find({
			relations: [
				'controls',
				'controls.device',
				'channels',
				'channels.device',
				'channels.controls',
				'channels.controls.channel',
				'channels.properties',
				'channels.properties.channel',
			],
		})) as TDevice[];

		this.logger.debug(`[LOOKUP ALL] Found ${devices.length} devices`);

		return devices;
	}

	async findOne<TDevice extends DeviceEntity>(id: string, type?: string): Promise<TDevice | null> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`[LOOKUP] Fetching device with id=${id}`);

		const device = (await repository
			.createQueryBuilder('device')
			.leftJoinAndSelect('device.controls', 'controls')
			.leftJoinAndSelect('controls.device', 'controlDevice')
			.leftJoinAndSelect('device.channels', 'channels')
			.leftJoinAndSelect('channels.device', 'channelDevice')
			.leftJoinAndSelect('channels.controls', 'channelControls')
			.leftJoinAndSelect('channelControls.channel', 'channelControlChannel')
			.leftJoinAndSelect('channels.properties', 'channelProperties')
			.leftJoinAndSelect('channelProperties.channel', 'channelPropertyChannel')
			.where('device.id = :id', { id })
			.getOne()) as TDevice | null;

		if (!device) {
			this.logger.debug(`[LOOKUP] Device with id=${id} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched device with id=${id}`);

		return device;
	}

	async findOneBy<TDevice extends DeviceEntity>(
		column: 'id' | 'category' | 'identifier' | 'name',
		value: string | number | boolean,
		type?: string,
	): Promise<TDevice | null> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`[LOOKUP] Fetching device with ${column}=${value}`);

		const device = (await repository
			.createQueryBuilder('device')
			.leftJoinAndSelect('device.controls', 'controls')
			.leftJoinAndSelect('controls.device', 'controlDevice')
			.leftJoinAndSelect('device.channels', 'channels')
			.leftJoinAndSelect('channels.device', 'channelDevice')
			.leftJoinAndSelect('channels.controls', 'channelControls')
			.leftJoinAndSelect('channelControls.channel', 'channelControlChannel')
			.leftJoinAndSelect('channels.properties', 'channelProperties')
			.leftJoinAndSelect('channelProperties.channel', 'channelPropertyChannel')
			.where(`device.${column} = :filterBy`, { filterBy: value })
			.getOne()) as TDevice | null;

		if (!device) {
			this.logger.debug(`[LOOKUP] Device with ${column}=${value} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched device with ${column}=${value}`);

		return device;
	}

	async create<TDevice extends DeviceEntity, TCreateDTO extends CreateDeviceDto>(
		createDto: TCreateDTO,
	): Promise<TDevice> {
		this.logger.debug('[CREATE] Creating new device');

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" attribute in data.');

			throw new DevicesException('Device type attribute is required.');
		}

		const mapping = this.devicesMapperService.getMapping<TDevice, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		(dtoInstance.channels || []).forEach((channel) => {
			channel.id = channel.id ?? uuid().toString();

			(channel.properties || []).forEach((property) => {
				property.id = property.id ?? uuid().toString();
			});
		});

		const channels = dtoInstance.channels || [];

		delete dtoInstance.channels;

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for device creation error=${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided device data are invalid.');
		}

		const repository: Repository<TDevice> = this.dataSource.getRepository(mapping.class);

		const device = repository.create(toInstance(mapping.class, dtoInstance));

		// Save the device
		const raw = await repository.save(device);

		for (const channelDtoInstance of channels) {
			this.logger.debug(`[CREATE] Creating new channel for deviceId=${raw.id}`);

			await this.channelsService.create({
				...channelDtoInstance,
				device: raw.id,
			});
		}

		// Retrieve the saved device with its full relations
		let savedDevice = (await this.getOneOrThrow(device.id)) as TDevice;

		if (mapping.afterCreate) {
			await mapping.afterCreate(savedDevice);

			// Reload a potentially updated device
			savedDevice = (await this.getOneOrThrow(device.id)) as TDevice;
		}

		this.logger.debug(`[CREATE] Successfully created device with id=${savedDevice.id}`);

		this.eventEmitter.emit(EventType.DEVICE_CREATED, savedDevice);

		return savedDevice;
	}

	async update<TDevice extends DeviceEntity, TUpdateDTO extends UpdateDeviceDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TDevice> {
		this.logger.debug(`[UPDATE] Updating device with id=${id}`);

		const device = await this.getOneOrThrow(id);

		const mapping = this.devicesMapperService.getMapping<TDevice, any, TUpdateDTO>(device.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TDevice> = this.dataSource.getRepository(mapping.class);

		Object.assign(device, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		await repository.save(device as TDevice);

		let updatedDevice = (await this.getOneOrThrow(device.id)) as TDevice;

		if (mapping.afterUpdate) {
			await mapping.afterUpdate(updatedDevice);

			updatedDevice = (await this.getOneOrThrow(device.id)) as TDevice;
		}

		this.logger.debug(`[UPDATE] Successfully updated device with id=${updatedDevice.id}`);

		this.eventEmitter.emit(EventType.DEVICE_UPDATED, updatedDevice);

		return updatedDevice;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing device with id=${id}`);

		// Get the full device entity before removal to preserve ID for event emission
		const fullDevice = await this.getOneOrThrow(id);

		await this.dataSource.transaction(async (manager) => {
			const device = await manager.findOneOrFail<DeviceEntity>(DeviceEntity, { where: { id } });

			const channels = await manager.find<ChannelEntity>(ChannelEntity, { where: { device: { id } } });

			for (const channel of channels) {
				await this.channelsService.remove(channel.id, manager);
			}

			const controls = await manager.find<DeviceControlEntity>(DeviceControlEntity, { where: { device: { id } } });

			for (const control of controls) {
				await this.devicesControlsService.remove(control.id, device.id, manager);
			}

			await manager.remove(device);

			this.logger.log(`[DELETE] Successfully removed device with id=${id}`);

			// Emit event with the full device entity captured before removal to preserve ID
			this.eventEmitter.emit(EventType.DEVICE_DELETED, fullDevice);
		});
	}

	async getOneOrThrow(id: string): Promise<DeviceEntity> {
		const device = await this.findOne(id);

		if (!id) {
			this.logger.error(`[ERROR] Device with id=${id} not found`);

			throw new DevicesNotFoundException('Device does not exist');
		}

		return device;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided device data are invalid.');
		}

		return dtoInstance;
	}
}
