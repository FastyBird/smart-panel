import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { EventType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { ChannelsService } from './channels.service';
import { PropertyValueService } from './property-value.service';

@Injectable()
export class ChannelsPropertiesService {
	private readonly logger = new Logger(ChannelsPropertiesService.name);

	constructor(
		@InjectRepository(ChannelPropertyEntity)
		private readonly repository: Repository<ChannelPropertyEntity>,
		private readonly channelsService: ChannelsService,
		private readonly propertyValueService: PropertyValueService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(channelId?: string): Promise<ChannelPropertyEntity[]> {
		if (channelId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all properties for channelId=${channelId}`);

			const channel = await this.channelsService.getOneOrThrow(channelId);

			const properties = await this.repository
				.createQueryBuilder('property')
				.innerJoinAndSelect('property.channel', 'channel')
				.where('channel.id = :channelId', { channelId: channel.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${properties.length} properties for channelId=${channelId}`);

			return properties;
		}

		this.logger.debug('[LOOKUP ALL] Fetching all properties');

		const properties = await this.repository.find({ relations: ['channel'] });

		this.logger.debug(`[LOOKUP ALL] Found ${properties.length} properties`);

		return properties;
	}

	async findOne(id: string, channelId?: string): Promise<ChannelPropertyEntity | null> {
		let property: ChannelPropertyEntity | null;

		if (channelId) {
			this.logger.debug(`[LOOKUP] Fetching property with id=${id} for channelId=${channelId}`);

			const channel = await this.channelsService.getOneOrThrow(channelId);

			property = await this.repository
				.createQueryBuilder('property')
				.innerJoinAndSelect('property.channel', 'channel')
				.where('property.id = :id', { id })
				.andWhere('channel.id = :channelId', { channelId: channel.id })
				.getOne();

			if (!property) {
				this.logger.warn(`[LOOKUP] Property with id=${id} for channelId=${channelId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched property with id=${id} for channelId=${channelId}`);
		} else {
			property = await this.repository.findOne({
				where: { id },
				relations: ['channel'],
			});

			if (!property) {
				this.logger.warn(`[LOOKUP] Property with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched property with id=${id}`);
		}

		return property;
	}

	async create(channelId: string, createDto: CreateChannelPropertyDto): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[CREATE] Creating new property for channelId=${channelId}`);

		const channel = await this.channelsService.getOneOrThrow(channelId);

		const dtoInstance = await this.validateDto<UpdateChannelPropertyDto>(CreateChannelPropertyDto, createDto);

		const property = this.repository.create(
			plainToInstance(
				ChannelPropertyEntity,
				{
					...dtoInstance,
					channel: channel.id,
				},
				{
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				},
			),
		);
		const rawEntity = await this.repository.save(property);

		if (dtoInstance.value) {
			await this.propertyValueService.write(rawEntity, dtoInstance.value);
		}

		const savedProperty = await this.getOneOrThrow(property.id);

		this.logger.debug(`[CREATE] Successfully created property with id=${savedProperty.id} for channelId=${channelId}`);

		this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_CREATED, savedProperty);

		return savedProperty;
	}

	async update(id: string, updateDto: UpdateChannelPropertyDto): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[UPDATE] Updating data source with id=${id}`);

		const property = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateChannelPropertyDto>(UpdateChannelPropertyDto, updateDto);

		Object.assign(
			property,
			omitBy(
				plainToInstance(ChannelPropertyEntity, dtoInstance, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeDefaultValues: false,
				}),
				isUndefined,
			),
		);

		const rawEntity = await this.repository.save(property);

		if (dtoInstance.value) {
			await this.propertyValueService.write(rawEntity, dtoInstance.value);
		}

		const updatedProperty = await this.getOneOrThrow(property.id);

		this.logger.debug(`[UPDATE] Successfully updated property with id=${updatedProperty.id}`);

		this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_UPDATED, updatedProperty);

		return updatedProperty;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing property with id=${id}`);

		const property = await this.getOneOrThrow(id);

		await this.repository.remove(property);

		this.logger.log(`[DELETE] Successfully removed property with id=${id}`);

		this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_DELETED, property);
	}

	async getOneOrThrow(id: string): Promise<ChannelPropertyEntity> {
		const property = await this.findOne(id);

		if (!property) {
			this.logger.error(`[ERROR] Property with id=${id} not found`);

			throw new DevicesNotFoundException('Channel property does not exist');
		}

		return property;
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

			throw new DevicesValidationException('Provided property data are invalid.');
		}

		return dtoInstance;
	}
}
