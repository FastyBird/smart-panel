import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { EventType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity } from '../entities/devices.entity';

import { PropertyValueService } from './property-value.service';

@Injectable()
export class ChannelsService {
	private readonly logger = new Logger(ChannelsService.name);

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly repository: Repository<ChannelEntity>,
		private readonly propertyValueService: PropertyValueService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	// Channels
	async findAll(deviceId?: string): Promise<ChannelEntity[]> {
		if (deviceId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all channels for deviceId=${deviceId}`);

			const channels = await this.repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where('device.id = :deviceId', { deviceId })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${channels.length} tichannelsles for deviceId=${deviceId}`);

			return channels;
		}

		this.logger.debug('[LOOKUP ALL] Fetching all channels');

		const channels = await this.repository.find({
			relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
		});

		this.logger.debug(`[LOOKUP ALL] Found ${channels.length} channels`);

		return channels;
	}

	async findOne(id: string, deviceId?: string): Promise<ChannelEntity | null> {
		let channel: ChannelEntity | null;

		if (deviceId) {
			this.logger.debug(`[LOOKUP] Fetching channel with id=${id} for deviceId=${deviceId}`);

			channel = await this.repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where('channel.id = :id', { id })
				.andWhere('device.id = :deviceId', { deviceId })
				.getOne();

			if (!channel) {
				this.logger.warn(`[LOOKUP] Channel with id=${id} for deviceId=${deviceId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched channel with id=${id} for deviceId=${deviceId}`);
		} else {
			channel = await this.repository.findOne({
				where: { id },
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});

			if (!channel) {
				this.logger.warn(`[LOOKUP] Channel with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched channel with id=${id}`);
		}

		return channel;
	}

	async create(createDto: CreateChannelDto): Promise<ChannelEntity> {
		this.logger.debug(`[CREATE] Creating new channel`);

		const dtoInstance = await this.validateDto<CreateChannelDto>(CreateChannelDto, createDto);

		(dtoInstance.properties || []).forEach((property) => {
			property.id = property.id ?? uuid().toString();
		});

		const channel = this.repository.create(
			plainToInstance(ChannelEntity, dtoInstance, {
				enableImplicitConversion: true,
				excludeExtraneousValues: true,
				exposeUnsetFields: false,
			}),
		);

		// Save the channel
		const raw = await this.repository.save(channel);

		for (const propertyDtoInstance of dtoInstance.properties || []) {
			if (propertyDtoInstance.value && propertyDtoInstance.id) {
				const rawProperty = raw.properties.find((entity) => entity.id === propertyDtoInstance.id);

				if (rawProperty) {
					await this.propertyValueService.write(rawProperty, propertyDtoInstance.value);
				}
			}
		}

		const savedChannel = await this.getOneOrThrow(channel.id);

		this.logger.debug(`[CREATE] Successfully created channel with id=${savedChannel.id}`);

		this.eventEmitter.emit(EventType.CHANNEL_CREATED, savedChannel);

		return savedChannel;
	}

	async update(id: string, updateDto: UpdateChannelDto): Promise<ChannelEntity> {
		this.logger.debug(`[UPDATE] Updating data source with id=${id}`);

		const channel = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateChannelDto>(UpdateChannelDto, updateDto);

		Object.assign(
			channel,
			omitBy(
				plainToInstance(ChannelEntity, dtoInstance, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeDefaultValues: false,
				}),
				isUndefined,
			),
		);

		await this.repository.save(channel);

		const updatedChannel = await this.getOneOrThrow(channel.id);

		this.logger.debug(`[UPDATE] Successfully updated channel with id=${updatedChannel.id}`);

		this.eventEmitter.emit(EventType.CHANNEL_UPDATED, updatedChannel);

		return updatedChannel;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing channel with id=${id}`);

		const channel = await this.getOneOrThrow(id);

		await this.repository.remove(channel);

		this.logger.log(`[DELETE] Successfully removed channel with id=${id}`);

		this.eventEmitter.emit(EventType.CHANNEL_DELETED, channel);
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
		const dtoInstance = plainToInstance(DtoClass, dto, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided channel data are invalid.');
		}

		return dtoInstance;
	}
}
