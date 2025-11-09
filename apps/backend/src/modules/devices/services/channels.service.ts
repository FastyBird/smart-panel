import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType } from '../devices.constants';
import { DevicesException, DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelControlEntity, ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';

import { ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsControlsService } from './channels.controls.service';
import { ChannelsPropertiesService } from './channels.properties.service';

@Injectable()
export class ChannelsService {
	private readonly logger = new Logger(ChannelsService.name);

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
			this.logger.debug(`[LOOKUP ALL] Fetching all channels count deviceId=${deviceId}`);

			const channels = await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.where('device.id = :deviceId', { deviceId })
				.getCount();

			this.logger.debug(`[LOOKUP ALL] Found that in system is ${channels} channels for deviceId=${deviceId}`);

			return channels;
		}

		this.logger.debug('[LOOKUP ALL] Fetching all channels count');

		const channels = await repository.count();

		this.logger.debug(`[LOOKUP ALL] Found that in system is ${channels} channels`);

		return channels;
	}

	// Channels
	async findAll<TChannel extends ChannelEntity>(deviceId?: string, type?: string): Promise<TChannel[]> {
		const mapping = type ? this.channelsMapperService.getMapping<TChannel, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (deviceId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all channels for deviceId=${deviceId}`);

			const channels = (await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where('device.id = :deviceId', { deviceId })
				.getMany()) as TChannel[];

			this.logger.debug(`[LOOKUP ALL] Found ${channels.length} channels for deviceId=${deviceId}`);

			return channels;
		}

		this.logger.debug('[LOOKUP ALL] Fetching all channels');

		const channels = (await repository.find({
			relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
		})) as TChannel[];

		this.logger.debug(`[LOOKUP ALL] Found ${channels.length} channels`);

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
			this.logger.debug(`[LOOKUP] Fetching channel with id=${id} for deviceId=${deviceId}`);

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
				this.logger.debug(`[LOOKUP] Channel with id=${id} for deviceId=${deviceId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched channel with id=${id} for deviceId=${deviceId}`);
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
				this.logger.debug(`[LOOKUP] Channel with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched channel with id=${id}`);
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
			this.logger.debug(`[LOOKUP] Fetching channel with ${column}=${value} for deviceId=${deviceId}`);

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
				this.logger.debug(`[LOOKUP] Channel with ${column}=${value} for deviceId=${deviceId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched channel with ${column}=${value} for deviceId=${deviceId}`);
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
				this.logger.debug(`[LOOKUP] Channel with ${column}=${value} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched channel with ${column}=${value}`);
		}

		return channel;
	}

	async create<TChannel extends ChannelEntity, TCreateDTO extends CreateChannelDto>(
		createDto: TCreateDTO,
	): Promise<TChannel> {
		this.logger.debug(`[CREATE] Creating new channel`);

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" attribute in data.');

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
			this.logger.error(`[VALIDATION FAILED] Validation failed for channel creation error=${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided channel data are invalid.');
		}

		const repository: Repository<TChannel> = this.dataSource.getRepository(mapping.class);

		const channel = repository.create(toInstance(mapping.class, dtoInstance));

		// Save the channel
		const raw = await repository.save(channel);

		for (const propertyDtoInstance of createDto.properties ?? []) {
			this.logger.debug(`[CREATE] Creating new property for channelId=${raw.id}`);

			await this.channelsPropertiesService.create(raw.id, propertyDtoInstance);
		}

		let savedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;

		if (mapping.afterCreate) {
			await mapping.afterCreate(savedChannel);

			savedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;
		}

		this.logger.debug(`[CREATE] Successfully created channel with id=${savedChannel.id}`);

		this.eventEmitter.emit(EventType.CHANNEL_CREATED, savedChannel);

		return savedChannel;
	}

	async update<TChannel extends ChannelEntity, TUpdateDTO extends UpdateChannelDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TChannel> {
		this.logger.debug(`[UPDATE] Updating data source with id=${id}`);

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

		this.logger.debug(`[UPDATE] Successfully updated channel with id=${updatedChannel.id}`);

		this.eventEmitter.emit(EventType.CHANNEL_UPDATED, updatedChannel);

		return updatedChannel;
	}

	async remove(id: string, manager?: EntityManager): Promise<void> {
		this.logger.debug(`[DELETE] Removing channel with id=${id}`);

		const fullChannel = await this.getOneOrThrow(id);

		if (typeof manager !== 'undefined') {
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

			this.logger.log(`[DELETE] Successfully removed channel with id=${id}`);

			this.eventEmitter.emit(EventType.CHANNEL_DELETED, fullChannel);
		} else {
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

				this.logger.log(`[DELETE] Successfully removed channel with id=${id}`);

				this.eventEmitter.emit(EventType.CHANNEL_DELETED, fullChannel);
			});
		}
	}

	async getOneOrThrow(id: string): Promise<ChannelEntity> {
		const channel = await this.findOne(id);

		if (!channel) {
			this.logger.error(`[ERROR] Channel with id=${id} not found`);

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
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided channel data are invalid.');
		}

		return dtoInstance;
	}
}
