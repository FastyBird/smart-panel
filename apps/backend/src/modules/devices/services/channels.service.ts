import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_MODULE_NAME, EventType } from '../devices.constants';
import { DevicesException, DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelControlEntity, ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';

import { ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsControlsService } from './channels.controls.service';
import { ChannelsPropertiesService } from './channels.properties.service';

@Injectable()
export class ChannelsService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsService');

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly repository: Repository<ChannelEntity>,
		private readonly channelsMapperService: ChannelsTypeMapperService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly channelsControlsService: ChannelsControlsService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	// Channels
	async getCount<TChannel extends ChannelEntity>(deviceId?: string, type?: string): Promise<number> {
		const mapping = type ? this.channelsMapperService.getMapping<TChannel, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (deviceId) {
			const channels = await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.where('device.id = :deviceId', { deviceId })
				.getCount();

			return channels;
		}

		const channels = await repository.count();

		return channels;
	}

	// Channels
	async findAll<TChannel extends ChannelEntity>(deviceId?: string, type?: string): Promise<TChannel[]> {
		const mapping = type ? this.channelsMapperService.getMapping<TChannel, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (deviceId) {
			const channels = (await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where('device.id = :deviceId', { deviceId })
				.getMany()) as TChannel[];

			return channels;
		}

		// Use QueryBuilder instead of find() to ensure device relation is properly loaded
		// with STI (Single Table Inheritance) subclasses
		const channels = (await repository
			.createQueryBuilder('channel')
			.innerJoinAndSelect('channel.device', 'device')
			.leftJoinAndSelect('channel.controls', 'controls')
			.leftJoinAndSelect('controls.channel', 'controlChannel')
			.leftJoinAndSelect('channel.properties', 'properties')
			.leftJoinAndSelect('properties.channel', 'propertyChannel')
			.getMany()) as TChannel[];

		return channels;
	}

	async findOne<TChannel extends ChannelEntity>(
		id: string,
		deviceId?: string,
		type?: string,
	): Promise<TChannel | null> {
		const mapping = type ? this.channelsMapperService.getMapping<TChannel, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		let channel: TChannel | null;

		if (deviceId) {
			channel = (await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where('channel.id = :id', { id })
				.andWhere('device.id = :deviceId', { deviceId })
				.getOne()) as TChannel | null;

			if (!channel) {
				return null;
			}
		} else {
			channel = (await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where('channel.id = :id', { id })
				.getOne()) as TChannel | null;

			if (!channel) {
				return null;
			}
		}

		return channel;
	}

	async findOneBy<TChannel extends ChannelEntity>(
		column: 'id' | 'category' | 'identifier' | 'name',
		value: string | number | boolean,
		deviceId?: string,
		type?: string,
	): Promise<TChannel | null> {
		const mapping = type ? this.channelsMapperService.getMapping<TChannel, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		let channel: TChannel | null;

		if (deviceId) {
			channel = (await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where(`channel.${column} = :filterBy`, { filterBy: value })
				.andWhere('device.id = :deviceId', { deviceId })
				.getOne()) as TChannel | null;

			if (!channel) {
				return null;
			}
		} else {
			channel = (await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where(`channel.${column} = :filterBy`, { filterBy: value })
				.getOne()) as TChannel | null;

			if (!channel) {
				return null;
			}
		}

		return channel;
	}

	async create<TChannel extends ChannelEntity, TCreateDTO extends CreateChannelDto>(
		createDto: TCreateDTO,
	): Promise<TChannel> {
		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" attribute in data.');

			throw new DevicesException('Channel type attribute is required.');
		}

		const mapping = this.channelsMapperService.getMapping<TChannel, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		delete dtoInstance.properties;

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Validation failed for channel creation error=${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided channel data are invalid.');
		}

		const repository: Repository<TChannel> = this.dataSource.getRepository(mapping.class);

		const channel = repository.create(toInstance(mapping.class, dtoInstance));

		// Save the channel
		const raw = await repository.save(channel);

		for (const propertyDtoInstance of createDto.properties ?? []) {
			await this.channelsPropertiesService.create(raw.id, propertyDtoInstance);
		}

		let savedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;

		if (mapping.afterCreate) {
			await mapping.afterCreate(savedChannel);

			savedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;
		}

		this.eventEmitter.emit(EventType.CHANNEL_CREATED, savedChannel);

		return savedChannel;
	}

	async update<TChannel extends ChannelEntity, TUpdateDTO extends UpdateChannelDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TChannel> {
		const channel = await this.getOneOrThrow(id);

		const mapping = this.channelsMapperService.getMapping<TChannel, any, TUpdateDTO>(channel.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TChannel> = this.dataSource.getRepository(mapping.class);

		Object.assign(channel, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		await repository.save(channel as TChannel);

		let updatedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;

		if (mapping.afterUpdate) {
			await mapping.afterUpdate(updatedChannel);

			updatedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;
		}

		this.eventEmitter.emit(EventType.CHANNEL_UPDATED, updatedChannel);

		return updatedChannel;
	}

	async remove(id: string, manager?: EntityManager): Promise<void> {
		if (typeof manager !== 'undefined') {
			const channel = await manager.findOneOrFail<ChannelEntity>(ChannelEntity, { where: { id } });

			// Capture channel ID and data before removal to preserve for event emission
			const channelForEvent = { ...channel };

			const properties = await manager.find<ChannelPropertyEntity>(ChannelPropertyEntity, {
				where: { channel: { id } },
			});

			for (const property of properties) {
				await this.channelsPropertiesService.remove(property.id, manager);
			}

			const controls = await manager.find<ChannelControlEntity>(ChannelControlEntity, { where: { channel: { id } } });

			for (const control of controls) {
				await this.channelsControlsService.remove(control.id, channel.id, manager);
			}

			await manager.remove(channel);

			this.logger.log(`Successfully removed channel with id=${id}`);

			// Emit event with the channel entity captured before removal to preserve ID
			this.eventEmitter.emit(EventType.CHANNEL_DELETED, channelForEvent);
		} else {
			// Get the full channel entity before removal to preserve ID for event emission
			const fullChannel = await this.getOneOrThrow(id);

			await this.dataSource.transaction(async (manager) => {
				const channel = await manager.findOneOrFail<ChannelEntity>(ChannelEntity, { where: { id } });

				const properties = await manager.find<ChannelPropertyEntity>(ChannelPropertyEntity, {
					where: { channel: { id } },
				});

				for (const property of properties) {
					await this.channelsPropertiesService.remove(property.id, manager);
				}

				const controls = await manager.find<ChannelControlEntity>(ChannelControlEntity, { where: { channel: { id } } });

				for (const control of controls) {
					await this.channelsControlsService.remove(control.id, channel.id, manager);
				}

				await manager.remove(channel);

				this.logger.log(`Successfully removed channel with id=${id}`);

				// Emit event with the full channel entity captured before removal to preserve ID
				this.eventEmitter.emit(EventType.CHANNEL_DELETED, fullChannel);
			});
		}
	}

	async getOneOrThrow(id: string): Promise<ChannelEntity> {
		const channel = await this.findOne(id);

		if (!channel) {
			this.logger.error(`Channel with id=${id} not found`);

			throw new DevicesNotFoundException('Channel does not exist');
		}

		return channel;
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
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided channel data are invalid.');
		}

		return dtoInstance;
	}
}
