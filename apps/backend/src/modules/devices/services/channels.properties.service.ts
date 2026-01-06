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
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { PropertyValueService } from './property-value.service';

@Injectable()
export class ChannelsPropertiesService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsPropertiesService');

	constructor(
		@InjectRepository(ChannelPropertyEntity)
		private readonly repository: Repository<ChannelPropertyEntity>,
		private readonly propertiesMapperService: ChannelsPropertiesTypeMapperService,
		private readonly propertyValueService: PropertyValueService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll<TProperty extends ChannelPropertyEntity>(
		channelId?: string | string[],
		type?: string,
	): Promise<TProperty[]> {
		const mapping = type ? this.propertiesMapperService.getMapping<TProperty, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (channelId) {
			if (Array.isArray(channelId)) {
				this.logger.debug(`Fetching all properties for channelIds=${channelId.join(', ')}`);

				const properties = (await repository
					.createQueryBuilder('property')
					.innerJoinAndSelect('property.channel', 'channel')
					.innerJoinAndSelect('channel.device', 'device')
					.where('channel.id IN (:...channelIds)', { channelIds: channelId })
					.getMany()) as TProperty[];

				this.logger.debug(`Found ${properties.length} properties for channelIds=${channelId.join(', ')}`);

				return properties;
			} else {
				this.logger.debug(`Fetching all properties for channelId=${channelId}`);

				const properties = (await repository
					.createQueryBuilder('property')
					.innerJoinAndSelect('property.channel', 'channel')
					.innerJoinAndSelect('channel.device', 'device')
					.where('channel.id = :channelId', { channelId })
					.getMany()) as TProperty[];

				this.logger.debug(`Found ${properties.length} properties for channelId=${channelId}`);

				return properties;
			}
		}

		this.logger.debug('Fetching all properties');

		const properties = (await repository.find({ relations: ['channel', 'channel.device'] })) as TProperty[];

		this.logger.debug(`Found ${properties.length} properties`);

		return properties;
	}

	async findOne<TProperty extends ChannelPropertyEntity>(
		id: string,
		channelId?: string,
		type?: string,
	): Promise<TProperty | null> {
		const mapping = type ? this.propertiesMapperService.getMapping<TProperty, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		let property: TProperty | null;

		if (channelId) {
			this.logger.debug(`Fetching property with id=${id} for channelId=${channelId}`);

			property = (await repository
				.createQueryBuilder('property')
				.innerJoinAndSelect('property.channel', 'channel')
				.innerJoinAndSelect('channel.device', 'device')
				.where('property.id = :id', { id })
				.andWhere('channel.id = :channelId', { channelId })
				.getOne()) as TProperty | null;

			if (!property) {
				this.logger.debug(`Property with id=${id} for channelId=${channelId} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched property with id=${id} for channelId=${channelId}`);
		} else {
			property = (await repository
				.createQueryBuilder('property')
				.innerJoinAndSelect('property.channel', 'channel')
				.innerJoinAndSelect('channel.device', 'device')
				.where('property.id = :id', { id })
				.getOne()) as TProperty | null;

			if (!property) {
				this.logger.debug(`Property with id=${id} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched property with id=${id}`);
		}

		return property;
	}

	async findOneBy<TProperty extends ChannelPropertyEntity>(
		column: 'id' | 'category' | 'identifier' | 'name',
		value: string | number | boolean,
		channelId?: string,
		type?: string,
	): Promise<TProperty | null> {
		const mapping = type ? this.propertiesMapperService.getMapping<TProperty, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		let property: TProperty | null;

		if (channelId) {
			this.logger.debug(`Fetching property with ${column}=${value} for channelId=${channelId}`);

			property = (await repository
				.createQueryBuilder('property')
				.innerJoinAndSelect('property.channel', 'channel')
				.innerJoinAndSelect('channel.device', 'device')
				.where(`property.${column} = :filterBy`, { filterBy: value })
				.andWhere('channel.id = :channelId', { channelId })
				.getOne()) as TProperty | null;

			if (!property) {
				this.logger.debug(`Property with ${column}=${value} for channelId=${channelId} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched property with ${column}=${value} for channelId=${channelId}`);
		} else {
			property = (await repository
				.createQueryBuilder('property')
				.innerJoinAndSelect('property.channel', 'channel')
				.innerJoinAndSelect('channel.device', 'device')
				.where(`property.${column} = :filterBy`, { filterBy: value })
				.getOne()) as TProperty | null;

			if (!property) {
				this.logger.debug(`Property with ${column}=${value} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched property with ${column}=${value}`);
		}

		return property;
	}

	async create<TProperty extends ChannelPropertyEntity, TCreateDTO extends CreateChannelPropertyDto>(
		channelId: string,
		createDto: TCreateDTO,
	): Promise<TProperty> {
		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" attribute in data.');

			throw new DevicesException('Channel property attribute type is required.');
		}

		const mapping = this.propertiesMapperService.getMapping<TProperty, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(
				`Validation failed:Validation failed for channel property creation error=${JSON.stringify(errors)}`,
			);

			throw new DevicesValidationException('Provided channel property data are invalid.');
		}

		const repository: Repository<TProperty> = this.dataSource.getRepository(mapping.class);

		const property = repository.create(
			toInstance(mapping.class, {
				...dtoInstance,
				channel: channelId,
			}),
		);

		// Save the property
		const raw = await repository.save(property);

		if (typeof createDto.value !== 'undefined') {
			await this.propertyValueService.write(raw, createDto.value);
		}

		let savedProperty = (await this.getOneOrThrow(property.id)) as TProperty;

		if (mapping.afterCreate) {
			await mapping.afterCreate(savedProperty);

			savedProperty = (await this.getOneOrThrow(property.id)) as TProperty;
		}

		this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_CREATED, savedProperty);

		return savedProperty;
	}

	async update<TProperty extends ChannelPropertyEntity, TUpdateDTO extends UpdateChannelPropertyDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TProperty> {
		this.logger.debug(`Updating data source with id=${id}`);

		const property = await this.getOneOrThrow(id);

		const mapping = this.propertiesMapperService.getMapping<TProperty, any, TUpdateDTO>(property.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TProperty> = this.dataSource.getRepository(mapping.class);

		// Check if any entity fields (non-value) are being changed
		const entityFieldsChanged = Object.keys(omitBy(toInstance(mapping.class, dtoInstance), isUndefined)).some(
			(key) => key !== 'value' && key !== 'type',
		);

		Object.assign(property, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		const raw = await repository.save(property as TProperty);

		// Track if value actually changed
		let valueChanged = false;
		if (typeof updateDto.value !== 'undefined') {
			valueChanged = await this.propertyValueService.write(raw, updateDto.value);
		}

		let updatedProperty = (await this.getOneOrThrow(property.id)) as TProperty;

		if (mapping.afterUpdate) {
			await mapping.afterUpdate(updatedProperty);

			updatedProperty = (await this.getOneOrThrow(property.id)) as TProperty;
		}

		this.logger.debug(`Successfully updated property with id=${updatedProperty.id}`);

		// Emit separate events for structural changes vs value-only changes
		// This allows listeners to differentiate between metadata updates (which may require cache invalidation)
		// and value updates (which don't need cache invalidation)
		if (entityFieldsChanged) {
			// Metadata changed - emit CHANNEL_PROPERTY_UPDATED (covers both metadata and value changes)
			this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_UPDATED, updatedProperty);
		} else if (valueChanged) {
			// Only value changed - emit CHANNEL_PROPERTY_VALUE_SET
			this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, updatedProperty);
		}

		return updatedProperty;
	}

	async remove(id: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
		const property = await manager.findOneOrFail<ChannelPropertyEntity>(ChannelPropertyEntity, {
			where: { id },
		});

		// Capture property entity before removal to preserve ID for event emission
		const propertyForEvent = { ...property };

		await manager.remove(property);

		this.logger.log(`Successfully removed property with id=${id}`);

		// Emit event with the property entity captured before removal to preserve ID
		this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_DELETED, propertyForEvent);
	}

	async getOneOrThrow(id: string): Promise<ChannelPropertyEntity> {
		const property = await this.findOne(id);

		if (!property) {
			this.logger.error(`Property with id=${id} not found`);

			throw new DevicesNotFoundException('Channel property does not exist');
		}

		return property;
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
			this.logger.error(`Validation failed:${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided property data are invalid.');
		}

		return dtoInstance;
	}
}
