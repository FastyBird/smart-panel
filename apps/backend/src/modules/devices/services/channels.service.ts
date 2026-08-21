import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';

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
import { isPrimaryKeyCollision } from '../utils/unique-constraint.utils';

import { ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsControlsService } from './channels.controls.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

export interface ChannelSummaryPage {
	channels: ChannelEntity[];
	total: number;
}

export interface BoundedDeviceChannels {
	channels: ChannelEntity[];
	deviceIds: Record<string, string>;
	truncated: boolean;
}

@Injectable()
export class ChannelsService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsService');

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly repository: Repository<ChannelEntity>,
		private readonly channelsMapperService: ChannelsTypeMapperService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly channelsControlsService: ChannelsControlsService,
		private readonly structureLock: DeviceStructureLockService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	// Channels
	async getCount<TChannel extends ChannelEntity>(deviceId?: string, type?: string): Promise<number> {
		const mapping = type ? this.channelsMapperService.getMapping<TChannel, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (deviceId) {
			this.logger.debug(`Fetching all channels count deviceId=${deviceId}`);

			const channels = await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.where('device.id = :deviceId', { deviceId })
				.getCount();

			this.logger.debug(`Found that in system is ${channels} channels for deviceId=${deviceId}`);

			return channels;
		}

		this.logger.debug('Fetching all channels count');

		const channels = await repository.count();

		this.logger.debug(`Found that in system is ${channels} channels`);

		return channels;
	}

	// Channels
	async findAll<TChannel extends ChannelEntity>(deviceId?: string, type?: string): Promise<TChannel[]> {
		const mapping = type ? this.channelsMapperService.getMapping<TChannel, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (deviceId) {
			this.logger.debug(`Fetching all channels for deviceId=${deviceId}`);

			const channels = (await repository
				.createQueryBuilder('channel')
				.innerJoinAndSelect('channel.device', 'device')
				.leftJoinAndSelect('channel.controls', 'controls')
				.leftJoinAndSelect('controls.channel', 'controlChannel')
				.leftJoinAndSelect('channel.properties', 'properties')
				.leftJoinAndSelect('properties.channel', 'propertyChannel')
				.where('device.id = :deviceId', { deviceId })
				.getMany()) as TChannel[];

			this.logger.debug(`Found ${channels.length} channels for deviceId=${deviceId}`);

			return channels;
		}

		this.logger.debug('Fetching all channels');

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

		this.logger.debug(`Found ${channels.length} channels`);

		return channels;
	}

	async findSummaryPage(deviceId: string, limit: number): Promise<ChannelSummaryPage> {
		const query = this.repository
			.createQueryBuilder('channel')
			.innerJoin('channel.device', 'device')
			.where('device.id = :deviceId', { deviceId })
			.orderBy('channel.name', 'ASC')
			.take(limit);
		const [channels, total] = await query.getManyAndCount();

		return { channels, total };
	}

	async findBoundedForDevices(
		deviceIds: string[],
		categories: string[],
		perDeviceLimit: number,
	): Promise<BoundedDeviceChannels> {
		if (deviceIds.length === 0 || categories.length === 0) {
			return { channels: [], deviceIds: {}, truncated: false };
		}

		interface ChannelIdRow {
			id: string;
			deviceId: string;
			rowNumber: string | number;
		}

		const devicePlaceholders = deviceIds.map(() => '?').join(', ');
		const categoryPlaceholders = categories.map(() => '?').join(', ');
		const idRows = await this.dataSource.query<ChannelIdRow[]>(
			`SELECT ranked."id" AS "id", ranked."deviceId" AS "deviceId", ranked."rowNumber" AS "rowNumber"
			 FROM (
			   SELECT channel."id" AS "id", channel."deviceId" AS "deviceId",
			          ROW_NUMBER() OVER (
			            PARTITION BY channel."deviceId"
			            ORDER BY channel."name", channel."id"
			          ) AS "rowNumber"
			   FROM devices_module_channels channel
			   WHERE channel."deviceId" IN (${devicePlaceholders})
			   AND channel."category" IN (${categoryPlaceholders})
			 ) ranked
			 WHERE ranked."rowNumber" <= ?
			 ORDER BY ranked."deviceId", ranked."rowNumber"`,
			[...deviceIds, ...categories, perDeviceLimit + 1],
		);
		const selectedRows = idRows.filter((row) => Number(row.rowNumber) <= perDeviceLimit);
		const channelIds = selectedRows.map((row) => row.id);
		const truncated = idRows.length > selectedRows.length;

		if (channelIds.length === 0) {
			return { channels: [], deviceIds: {}, truncated };
		}

		const channels = await this.repository
			.createQueryBuilder('channel')
			.where('channel.id IN (:...channelIds)', { channelIds })
			.getMany();

		return {
			channels,
			deviceIds: Object.fromEntries(selectedRows.map((row) => [row.id, row.deviceId])),
			truncated,
		};
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
			this.logger.debug(`Fetching channel with id=${id} for deviceId=${deviceId}`);

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
				this.logger.debug(`Channel with id=${id} for deviceId=${deviceId} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched channel with id=${id} for deviceId=${deviceId}`);
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
				this.logger.debug(`Channel with id=${id} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched channel with id=${id}`);
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
			this.logger.debug(`Fetching channel with ${column}=${value} for deviceId=${deviceId}`);

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
				this.logger.debug(`Channel with ${column}=${value} for deviceId=${deviceId} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched channel with ${column}=${value} for deviceId=${deviceId}`);
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
				this.logger.debug(`Channel with ${column}=${value} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched channel with ${column}=${value}`);
		}

		return channel;
	}

	async create<TChannel extends ChannelEntity, TCreateDTO extends CreateChannelDto>(
		createDto: TCreateDTO,
	): Promise<TChannel> {
		this.logger.debug('Creating new channel');

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

		// Validate parent channel belongs to the same device
		if (dtoInstance.parent) {
			const parentChannel = await this.repository.findOne({
				where: { id: dtoInstance.parent },
				relations: ['device'],
			});

			if (!parentChannel) {
				this.logger.error(`Parent channel with id=${dtoInstance.parent} does not exist`);

				throw new DevicesValidationException('The specified parent channel does not exist.');
			}

			const parentDeviceId = typeof parentChannel.device === 'string' ? parentChannel.device : parentChannel.device.id;

			if (parentDeviceId !== dtoInstance.device) {
				this.logger.error(
					`Parent channel with id=${dtoInstance.parent} belongs to a different device (${parentDeviceId} !== ${dtoInstance.device})`,
				);

				throw new DevicesValidationException('Parent channel must belong to the same device.');
			}
		}

		const repository: Repository<TChannel> = this.dataSource.getRepository(mapping.class);

		const channel = repository.create(toInstance(mapping.class, dtoInstance));

		// `id` is client-suppliable here as it is on the device create, and the same two hazards follow.
		// `save()` treats a row whose primary key exists as an *update*, so a create carrying an existing
		// id moved that channel under this device instead of inserting — and `DevicesService.create()`'s
		// rollback then removed it as one of its own, destroying a channel the request had nothing to do
		// with. Asked of the base repository, because a collision with a channel of *another* type is the
		// same collision: ids are unique across the table, not per subclass.
		if (channel.id) {
			const existing = await this.repository.findOne({ where: { id: channel.id } });

			if (existing) {
				this.logger.error(`[VALIDATION FAILED] Channel id=${channel.id} already exists, refusing to create over it`);

				throw new DevicesValidationException(
					`Channel with id=${channel.id} already exists. Creating a channel with an id already in use is not allowed.`,
				);
			}
		}

		// The channel and the properties created with it go in under the structure lock, so a device
		// recategorisation cannot judge this device's structure in the window between them: half a
		// channel is not a structure anything should be validated against. The nested property creates
		// take the same lock and pass straight through it — it is re-entrant per call chain (see
		// DeviceStructureLockService).
		await this.structureLock.runExclusive(async (): Promise<void> => {
			// Inserted, not saved: the check above closes the collision only for a caller who is alone,
			// and two requests carrying the same client-generated uuid can both pass it before either
			// writes. `insert()` always issues an INSERT, so the primary key constraint decides. The check
			// stays for the message — a caller reusing an id gets a sentence, not a constraint violation.
			await repository
				.insert(channel as unknown as Parameters<Repository<TChannel>['insert']>[0])
				.catch((error: unknown) => {
					if (isPrimaryKeyCollision(error)) {
						this.logger.error(
							`[VALIDATION FAILED] Channel id=${channel.id} was created concurrently by another request`,
						);

						throw new DevicesValidationException(
							`Channel with id=${channel.id} already exists. Creating a channel with an id already in use is not allowed.`,
						);
					}

					throw error;
				});

			try {
				for (const propertyDtoInstance of createDto.properties ?? []) {
					this.logger.debug(`Creating new property for channelId=${channel.id}`);

					await this.channelsPropertiesService.create(channel.id, propertyDtoInstance);
				}
			} catch (error) {
				this.logger.error(`Nested creation failed for channelId=${channel.id}, rolling the channel back`);

				// One request, one outcome. A property rejected halfway — the second projection of a
				// virtual channel found incompatible, say — used to leave the channel and the properties
				// before it behind, with the caller told the whole thing failed: a retry then walked into
				// its own leftovers, and a client that had heard the earlier properties announce themselves
				// held children of a channel it had never been told about, because CHANNEL_CREATED is
				// emitted only after this returns.
				//
				// Properties go through their own removal rather than the row cascade, exactly as the
				// device-level rollback does: a property's stored values live outside its row, and only the
				// entity-removal lifecycle clears them. That removal emits each property's deletion too,
				// which is what answers the creations the client already saw.
				const orphaned = await this.channelsPropertiesService
					.findAll(channel.id)
					.catch((readError: unknown): ChannelPropertyEntity[] => {
						this.logger.error(
							`Failed to read back properties for rolled-back channelId=${channel.id}`,
							readError instanceof Error ? readError : undefined,
						);

						return [];
					});

				for (const property of orphaned) {
					try {
						await this.channelsPropertiesService.remove(property.id);
					} catch (cleanupError) {
						this.logger.error(
							`Failed to roll back property id=${property.id} for channelId=${channel.id}`,
							cleanupError instanceof Error ? cleanupError : undefined,
						);
					}
				}

				// Removed as an entity rather than deleted as a row, and re-read first — the same reasoning
				// as the device rollback one level up: `remove()` runs the subscribers a raw delete skips,
				// and a freshly loaded row carries no relations for TypeORM to cascade across in memory.
				// Not routed through this service's own `remove()`, which emits CHANNEL_DELETED and
				// re-parents children: this channel never announced itself, so there is nothing to answer.
				const rollbackTarget = await repository.findOne({
					where: { id: channel.id } as FindOptionsWhere<TChannel>,
				});

				if (rollbackTarget) {
					await repository.remove(rollbackTarget);
				}

				throw error;
			}
		});

		let savedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;

		if (mapping.afterCreate) {
			await mapping.afterCreate(savedChannel);

			savedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;
		}

		this.logger.debug(`Successfully created channel with id=${savedChannel.id}`);

		this.eventEmitter.emit(EventType.CHANNEL_CREATED, savedChannel);

		return savedChannel;
	}

	async update<TChannel extends ChannelEntity, TUpdateDTO extends UpdateChannelDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TChannel> {
		this.logger.debug(`Updating data source with id=${id}`);

		const channel = await this.getOneOrThrow(id);

		const mapping = this.channelsMapperService.getMapping<TChannel, any, TUpdateDTO>(channel.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		// Validate parent channel belongs to the same device (if parent is being updated)
		if (dtoInstance.parent !== undefined && dtoInstance.parent !== null) {
			const parentChannel = await this.repository.findOne({
				where: { id: dtoInstance.parent },
				relations: ['device'],
			});

			if (!parentChannel) {
				this.logger.error(`Parent channel with id=${dtoInstance.parent} does not exist`);

				throw new DevicesValidationException('The specified parent channel does not exist.');
			}

			const parentDeviceId = typeof parentChannel.device === 'string' ? parentChannel.device : parentChannel.device.id;
			const channelDeviceId = typeof channel.device === 'string' ? channel.device : channel.device.id;

			if (parentDeviceId !== channelDeviceId) {
				this.logger.error(
					`Parent channel with id=${dtoInstance.parent} belongs to a different device (${parentDeviceId} !== ${channelDeviceId})`,
				);

				throw new DevicesValidationException('Parent channel must belong to the same device.');
			}

			// Check for circular reference by walking up the parent chain
			const visited = new Set<string>([id]);
			let currentParentId: string | null = dtoInstance.parent;

			while (currentParentId !== null) {
				if (visited.has(currentParentId)) {
					this.logger.error(
						`Circular parent reference detected: setting parent to ${dtoInstance.parent} would create a cycle`,
					);

					throw new DevicesValidationException(
						'Circular parent reference detected. A channel cannot be its own ancestor.',
					);
				}

				visited.add(currentParentId);

				const currentParent = await this.repository.findOne({ where: { id: currentParentId } });

				currentParentId = currentParent?.parentId ?? null;
			}
		}

		const repository: Repository<TChannel> = this.dataSource.getRepository(mapping.class);

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(toInstance(mapping.class, dtoInstance), isUndefined);

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged = Object.keys(updateFields).some((key) => {
			const newValue = (updateFields as Record<string, unknown>)[key];
			const existingValue = (channel as unknown as Record<string, unknown>)[key];

			// Deep comparison for arrays
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

		// Under the structure lock, and with the hook inside it, for the reason the create above spells
		// out: a channel's category is part of the structure a device recategorisation judges itself
		// against, and the hook that judges *this* change reads the device's category in turn.
		await this.structureLock.runExclusive(async (): Promise<void> => {
			// Re-read after acquiring the ticket. Stale pruning may have removed the row while this update
			// was validating; saving the earlier entity would otherwise insert it again.
			const current = (await this.getOneOrThrow(id)) as TChannel;
			const previous = { ...current } as Readonly<Partial<TChannel>>;

			Object.assign(current, updateFields);

			if (mapping.beforeUpdate) {
				await mapping.beforeUpdate(current, previous);
			}

			await repository.save(current);
		});

		let updatedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;

		if (mapping.afterUpdate) {
			await mapping.afterUpdate(updatedChannel);

			updatedChannel = (await this.getOneOrThrow(channel.id)) as TChannel;
		}

		this.logger.debug(`Successfully updated channel with id=${updatedChannel.id}`);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.CHANNEL_UPDATED, updatedChannel);
		}

		return updatedChannel;
	}

	async remove(id: string, manager?: EntityManager): Promise<void> {
		this.logger.debug(`Removing channel with id=${id}`);

		if (typeof manager !== 'undefined') {
			const channel = await manager.findOneOrFail<ChannelEntity>(ChannelEntity, { where: { id } });

			// Capture channel ID and data before removal to preserve for event emission
			const channelForEvent = { ...channel };

			// Find children before clearing parentId (SQLite doesn't enforce FK constraints)
			const children = await manager.find<ChannelEntity>(ChannelEntity, { where: { parentId: id } });

			// Clear parentId for all children
			if (children.length > 0) {
				await manager.update(ChannelEntity, { parentId: id }, { parentId: null });
			}

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

			// Emit CHANNEL_UPDATED events for children whose parentId was cleared
			for (const child of children) {
				const updatedChild = { ...child, parentId: null, parent: null };
				this.eventEmitter.emit(EventType.CHANNEL_UPDATED, updatedChild);
			}

			// Emit event with the channel entity captured before removal to preserve ID
			this.eventEmitter.emit(EventType.CHANNEL_DELETED, channelForEvent);
		} else {
			// Get the full channel entity before removal to preserve ID for event emission
			const fullChannel = await this.getOneOrThrow(id);

			// Store children for event emission after transaction
			let childrenForEvents: ChannelEntity[] = [];

			await this.dataSource.transaction(async (manager) => {
				const channel = await manager.findOneOrFail<ChannelEntity>(ChannelEntity, { where: { id } });

				// Find children before clearing parentId (SQLite doesn't enforce FK constraints)
				childrenForEvents = await manager.find<ChannelEntity>(ChannelEntity, { where: { parentId: id } });

				// Clear parentId for all children
				if (childrenForEvents.length > 0) {
					await manager.update(ChannelEntity, { parentId: id }, { parentId: null });
				}

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
			});

			// Emit CHANNEL_UPDATED events for children whose parentId was cleared (after transaction)
			for (const child of childrenForEvents) {
				const updatedChild = { ...child, parentId: null, parent: null };
				this.eventEmitter.emit(EventType.CHANNEL_UPDATED, updatedChild);
			}

			// Emit event with the full channel entity captured before removal to preserve ID
			this.eventEmitter.emit(EventType.CHANNEL_DELETED, fullChannel);
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
