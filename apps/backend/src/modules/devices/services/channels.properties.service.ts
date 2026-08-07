import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_MODULE_NAME, EventType, PermissionType } from '../devices.constants';
import { DevicesException, DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { SUPPORTED_PROPERTY_COMMAND_DATA_TYPES } from '../utils/property-command-value.utils';
import { resolvePropertyUnit } from '../utils/property-metadata.utils';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

export interface BoundedChannelProperties {
	properties: ChannelPropertyEntity[];
	totals: Record<string, number>;
}

export interface WritablePropertyCandidates {
	properties: ChannelPropertyEntity[];
	total: number;
}

@Injectable()
export class ChannelsPropertiesService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsPropertiesService');

	constructor(
		@InjectRepository(ChannelPropertyEntity)
		private readonly repository: Repository<ChannelPropertyEntity>,
		private readonly propertiesMapperService: ChannelsPropertiesTypeMapperService,
		private readonly propertyValueService: PropertyValueService,
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
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

	async findBoundedForChannels(
		channelIds: string[],
		perChannelLimit: number,
		strictValues = false,
		propertyCategories?: string[],
	): Promise<BoundedChannelProperties> {
		if (channelIds.length === 0 || propertyCategories?.length === 0) {
			return { properties: [], totals: {} };
		}

		interface PropertyIdRow {
			id: string;
		}

		interface PropertyCountRow {
			channelId: string;
			propertyCount: string | number;
		}

		const placeholders = channelIds.map(() => '?').join(', ');
		const categoryPredicate = propertyCategories
			? `AND property."category" IN (${propertyCategories.map(() => '?').join(', ')})`
			: '';
		const [idRows, countRows] = await Promise.all([
			this.dataSource.query<PropertyIdRow[]>(
				`SELECT ranked."id" AS "id"
				 FROM (
				   SELECT property."id" AS "id",
				          ROW_NUMBER() OVER (
				            PARTITION BY property."channelId"
				            ORDER BY COALESCE(property."name", ''), property."id"
				          ) AS "rowNumber"
				   FROM devices_module_channels_properties property
				   WHERE property."channelId" IN (${placeholders})
				   ${categoryPredicate}
				 ) ranked
				 WHERE ranked."rowNumber" <= ?`,
				[...channelIds, ...(propertyCategories ?? []), perChannelLimit],
			),
			(() => {
				const query = this.repository
					.createQueryBuilder('property')
					.innerJoin('property.channel', 'channel')
					.select('channel.id', 'channelId')
					.addSelect('COUNT(property.id)', 'propertyCount')
					.where('channel.id IN (:...channelIds)', { channelIds });

				if (propertyCategories) {
					query.andWhere('property.category IN (:...propertyCategories)', { propertyCategories });
				}

				return query.groupBy('channel.id').getRawMany<PropertyCountRow>();
			})(),
		]);
		const propertyIds = idRows.map((row) => row.id);
		const properties =
			propertyIds.length === 0
				? []
				: await this.repository
						.createQueryBuilder('property')
						.innerJoinAndSelect('property.channel', 'channel')
						.where('property.id IN (:...propertyIds)', { propertyIds })
						.callListeners(!strictValues)
						.getMany();

		if (strictValues) {
			const values = await this.propertyValueService.readLatestManyStrict(properties);

			for (const property of properties) {
				property.unit = resolvePropertyUnit(property);
				property.value = values.get(property.id) ?? null;
			}
		}

		return {
			properties,
			totals: Object.fromEntries(countRows.map((row) => [row.channelId, Number(row.propertyCount)])),
		};
	}

	async findWritableCandidates(limit: number): Promise<WritablePropertyCandidates> {
		const query = this.repository
			.createQueryBuilder('property')
			.innerJoinAndSelect('property.channel', 'channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('device.enabled = :enabled', { enabled: true })
			.andWhere('device.hidden = :hidden', { hidden: false })
			.andWhere('property.dataType IN (:...supportedDataTypes)', {
				supportedDataTypes: SUPPORTED_PROPERTY_COMMAND_DATA_TYPES,
			})
			.andWhere(
				'(property.permissions = :readWrite OR property.permissions = :writeOnly ' +
					'OR property.permissions LIKE :readWriteFirst OR property.permissions LIKE :readWriteMiddle ' +
					'OR property.permissions LIKE :readWriteLast OR property.permissions LIKE :writeOnlyFirst ' +
					'OR property.permissions LIKE :writeOnlyMiddle OR property.permissions LIKE :writeOnlyLast)',
				{
					readWrite: PermissionType.READ_WRITE,
					writeOnly: PermissionType.WRITE_ONLY,
					readWriteFirst: `${PermissionType.READ_WRITE},%`,
					readWriteMiddle: `%,${PermissionType.READ_WRITE},%`,
					readWriteLast: `%,${PermissionType.READ_WRITE}`,
					writeOnlyFirst: `${PermissionType.WRITE_ONLY},%`,
					writeOnlyMiddle: `%,${PermissionType.WRITE_ONLY},%`,
					writeOnlyLast: `%,${PermissionType.WRITE_ONLY}`,
				},
			)
			.orderBy('device.name', 'ASC')
			.addOrderBy('channel.name', 'ASC')
			.addOrderBy('property.name', 'ASC')
			.addOrderBy('property.id', 'ASC')
			.callListeners(false)
			.take(limit);
		const [properties, total] = await query.getManyAndCount();

		return { properties, total };
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

		// A property whose value is stored under *another* property's key — a virtual device's linked
		// property, say — has no series of its own to seed, and creation dispatches no command that the
		// supplied value could have meant instead (unlike the update path below, whose callers forward
		// the value to the source device's platform). The only thing it could become is a fabricated
		// measurement of the source device: a value in the source's history that its hardware never
		// reported, taking its latest value and trend with it. Refused rather than silently dropped,
		// because a caller that sent a value has to be told it was not, and could not have been, stored.
		//
		// Checked on the built-but-unsaved entity, before `repository.save` below, so a refused create
		// leaves no row behind — and before the `afterCreate` hook, whose implementations may rewrite the
		// very fields this decides on. `null` is not refused: it means "no value", which is precisely
		// what a projection has of its own, and PropertyValueService.write() already treats it as a no-op.
		//
		// The registry answers this in core's own terms — "does this property own its series?" — so core
		// stays unaware of any particular plugin, exactly as it does in PropertyValueService.
		if (createDto.value !== undefined && createDto.value !== null && this.valueSourceRegistry.isProjected(property)) {
			this.logger.error('Validation failed: A value cannot be stored on a property that projects another one.');

			throw new DevicesValidationException(
				'Channel property value cannot be set on a property whose value is stored by its source property.',
			);
		}

		// The type owner's last look at the row before it exists — the only point at which an invariant
		// spanning the property and the channel it is being attached to is decidable, since `channelId`
		// is a route parameter and never reaches the create DTO. Throwing here persists nothing.
		if (mapping.beforeCreate) {
			await mapping.beforeCreate(property, channelId);
		}

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

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(toInstance(mapping.class, dtoInstance), isUndefined);

		// Check if any entity fields (non-value) are actually being changed by comparing with existing values
		const entityFieldsChanged = Object.keys(updateFields).some((key) => {
			if (key === 'value' || key === 'type') {
				return false;
			}

			const newValue = (updateFields as Record<string, unknown>)[key];
			const existingValue = (property as unknown as Record<string, unknown>)[key];

			// Deep comparison for arrays (like format)
			if (Array.isArray(newValue) && Array.isArray(existingValue)) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Deep comparison for plain objects
			if (
				typeof newValue === 'object' &&
				typeof existingValue === 'object' &&
				newValue !== null &&
				existingValue !== null
			) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Handle null/undefined comparison
			if (newValue === null && existingValue === null) {
				return false;
			}
			if (newValue === null || existingValue === null) {
				return true;
			}

			// Simple value comparison
			return newValue !== existingValue;
		});

		Object.assign(property, updateFields);

		// The type owner's last look at the merged row, before anything is written — the only point at
		// which an invariant spanning a field the PATCH sent and a field it did not is decidable.
		if (mapping.beforeUpdate) {
			await mapping.beforeUpdate(property as TProperty);
		}

		const raw = await repository.save(property as TProperty);

		// Track if value actually changed
		//
		// Deliberately not mirroring create()'s refusal above for a projected property. Here the value
		// has a second, legitimate meaning: both property controllers dispatch it to the device's own
		// platform right after this returns, and for a virtual device that platform forwards it to the
		// source's — so the request is coherent and rejecting it would remove the only way to command a
		// virtual device over REST. It is only the optimistic local echo into the source's series that is
		// not coherent, and PropertyValueService.write() drops exactly that, leaving the source's own
		// report to record what the hardware actually did.
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
		const property = await manager.findOne<ChannelPropertyEntity>(ChannelPropertyEntity, {
			where: { id },
		});

		if (!property) {
			this.logger.warn(`Property with id=${id} not found during removal (skipping)`);
			return;
		}

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
