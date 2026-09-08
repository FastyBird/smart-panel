import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { buildSqliteFtsNameRankExpression } from '../../../common/utils/sqlite-fts.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { type StorageBackendBinding } from '../../storage/services/storage.service';
import {
	ChannelCategory,
	DEVICES_MODULE_NAME,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { DevicesException, DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';
import {
	SUPPORTED_PROPERTY_COMMAND_DATA_TYPES,
	validatePropertyCommandValue,
} from '../utils/property-command-value.utils';
import { resolvePropertyUnit } from '../utils/property-metadata.utils';
import { isPrimaryKeyCollision } from '../utils/unique-constraint.utils';

import {
	type ChannelPropertyTypeMapping,
	ChannelsPropertiesTypeMapperService,
} from './channels.properties-type-mapper.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService, type PropertyValueWriteResult } from './property-value.service';

export interface BoundedChannelProperties {
	properties: ChannelPropertyEntity[];
	totals: Record<string, number>;
}

export interface WritablePropertyCandidates {
	properties: ChannelPropertyEntity[];
	total: number;
}

export interface VisibleReadableStateCandidateScope {
	roomIds?: string[];
	zoneId?: string;
}

export interface VisibleReadableStateCandidatesInput {
	limit: number;
	offset?: number;
	scope?: VisibleReadableStateCandidateScope;
	roomParentId?: string;
	channelCategories?: ChannelCategory[];
	propertyCategories?: PropertyCategory[];
	dataTypes?: DataTypeType[];
}

export interface VisibleReadableStateCandidates {
	properties: ChannelPropertyEntity[];
	total: number;
}

export interface VisiblePropertySearchSummary {
	id: string;
	name: string | null;
	identifier: string | null;
	category: PropertyCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	channelId: string;
	channelName: string;
	channelCategory: ChannelCategory;
	deviceId: string;
	deviceName: string;
	deviceCategory: DeviceCategory;
	deviceEnabled: boolean;
	roomId: string | null;
	rankTier: number;
	lexicalScore: number;
}

export interface VisiblePropertySearchSummaryInput {
	match: string;
	offset?: number;
	limit: number;
	rawQuery?: string;
	normalizedQuery?: string;
	normalizedTokens?: string[];
	scope?: {
		roomIds?: string[];
		zoneId?: string;
	};
	roomParentId?: string;
	categories?: PropertyCategory[];
	candidateCapability?: 'read' | 'write';
}

export interface VisiblePropertySearchSummaryPage {
	properties: VisiblePropertySearchSummary[];
	total: number;
}

export interface ChannelPropertyUpdateOptions {
	strictValuePersistence?: boolean;
	storageBinding?: StorageBackendBinding;
	comparePersistedValue?: boolean;
	expectedPersistedState?: PropertyValueState | null;
	beforeValuePersistence?: () => Promise<void>;
	valueTimestamp?: Date;
	resolveValueTimestamp?: () => Date;
}

interface WindowedValueCommitResult {
	readonly changed: boolean;
	readonly state: PropertyValueState | null;
	readonly held: boolean;
	readonly forceValueEvent: boolean;
}

@Injectable()
export class ChannelsPropertiesService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsPropertiesService');
	private static readonly VISIBLE_READABLE_STATE_CANDIDATE_MAX_LIMIT = 500;
	private commandWindowCleanupTimer: NodeJS.Timeout | null = null;

	constructor(
		@InjectRepository(ChannelPropertyEntity)
		private readonly repository: Repository<ChannelPropertyEntity>,
		private readonly propertiesMapperService: ChannelsPropertiesTypeMapperService,
		private readonly propertyValueService: PropertyValueService,
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
		private readonly structureLock: DeviceStructureLockService,
		private readonly propertyStateCoordinator: PropertyStateCoordinatorService,
		private readonly propertyCommandWindowService: PropertyCommandWindowService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit(): void {
		if (this.commandWindowCleanupTimer !== null) {
			return;
		}

		this.commandWindowCleanupTimer = setInterval(() => {
			void this.recoverExpiredCommandWindows().catch((error: unknown) => {
				const message = error instanceof Error ? error.message : 'unknown failure';
				this.logger.error(`Failed to recover an expired property command window: ${message}`);
			});
		}, 500);
		this.commandWindowCleanupTimer.unref();
	}

	onModuleDestroy(): void {
		if (this.commandWindowCleanupTimer !== null) {
			clearInterval(this.commandWindowCleanupTimer);
			this.commandWindowCleanupTimer = null;
		}

		this.propertyCommandWindowService.clear();
	}

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

	async findWritableCandidates(limit: number, offset = 0): Promise<WritablePropertyCandidates> {
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
			.take(limit)
			.skip(offset);
		const [properties, total] = await query.getManyAndCount();

		return { properties, total };
	}

	async findVisibleReadableStateCandidates(
		input: VisibleReadableStateCandidatesInput,
	): Promise<VisibleReadableStateCandidates> {
		const offset = input.offset ?? 0;

		if (!Number.isInteger(input.limit) || input.limit < 0) {
			throw new RangeError('Visible readable state candidate limit must be a non-negative integer');
		}
		if (input.limit > ChannelsPropertiesService.VISIBLE_READABLE_STATE_CANDIDATE_MAX_LIMIT) {
			throw new RangeError(
				`At most ${ChannelsPropertiesService.VISIBLE_READABLE_STATE_CANDIDATE_MAX_LIMIT} visible readable state candidates may be selected at once`,
			);
		}
		if (!Number.isInteger(offset) || offset < 0) {
			throw new RangeError('Visible readable state candidate offset must be a non-negative integer');
		}
		if (
			input.limit === 0 ||
			input.scope?.roomIds?.length === 0 ||
			input.channelCategories?.length === 0 ||
			input.propertyCategories?.length === 0 ||
			input.dataTypes?.length === 0
		) {
			return { properties: [], total: 0 };
		}

		const query = this.repository
			.createQueryBuilder('property')
			.innerJoinAndSelect('property.channel', 'channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('device.hidden = :hidden', { hidden: false })
			.andWhere(
				'(property.permissions = :readOnly OR property.permissions = :readWrite ' +
					'OR property.permissions LIKE :readOnlyFirst OR property.permissions LIKE :readOnlyMiddle ' +
					'OR property.permissions LIKE :readOnlyLast OR property.permissions LIKE :readWriteFirst ' +
					'OR property.permissions LIKE :readWriteMiddle OR property.permissions LIKE :readWriteLast)',
				{
					readOnly: PermissionType.READ_ONLY,
					readWrite: PermissionType.READ_WRITE,
					readOnlyFirst: `${PermissionType.READ_ONLY},%`,
					readOnlyMiddle: `%,${PermissionType.READ_ONLY},%`,
					readOnlyLast: `%,${PermissionType.READ_ONLY}`,
					readWriteFirst: `${PermissionType.READ_WRITE},%`,
					readWriteMiddle: `%,${PermissionType.READ_WRITE},%`,
					readWriteLast: `%,${PermissionType.READ_WRITE}`,
				},
			);

		if (input.scope?.roomIds) {
			query.andWhere('device.roomId IN (:...roomIds)', { roomIds: input.scope.roomIds });
		}
		if (input.scope?.zoneId) {
			query
				.innerJoin('device.deviceZones', 'stateCandidateZone')
				.andWhere('stateCandidateZone.zoneId = :zoneId', { zoneId: input.scope.zoneId });
		}
		if (input.roomParentId) {
			query.andWhere(
				'device.roomId IN (SELECT state_candidate_room.id FROM spaces_module_spaces state_candidate_room ' +
					'WHERE state_candidate_room.parentId = :roomParentId)',
				{ roomParentId: input.roomParentId },
			);
		}
		if (input.channelCategories) {
			query.andWhere('channel.category IN (:...channelCategories)', {
				channelCategories: input.channelCategories,
			});
		}
		if (input.propertyCategories) {
			query.andWhere('property.category IN (:...propertyCategories)', {
				propertyCategories: input.propertyCategories,
			});
		}
		if (input.dataTypes) {
			query.andWhere('property.dataType IN (:...dataTypes)', { dataTypes: input.dataTypes });
		}

		const [properties, total] = await query
			.addSelect('COALESCE(property.name, property.identifier, property.id)', 'stateCandidatePropertyOrder')
			.orderBy('device.name', 'ASC')
			.addOrderBy('device.id', 'ASC')
			.addOrderBy('channel.name', 'ASC')
			.addOrderBy('channel.id', 'ASC')
			.addOrderBy('stateCandidatePropertyOrder', 'ASC')
			.addOrderBy('property.id', 'ASC')
			.callListeners(false)
			.take(input.limit)
			.skip(offset)
			.getManyAndCount();

		return { properties, total };
	}

	async searchVisibleSummaryPage(input: VisiblePropertySearchSummaryInput): Promise<VisiblePropertySearchSummaryPage> {
		if (input.limit <= 0 || input.scope?.roomIds?.length === 0 || input.categories?.length === 0) {
			return { properties: [], total: 0 };
		}

		const predicates = [
			'home_context_entity_search_fts.entity_kind = ?',
			'home_context_entity_search_fts MATCH ?',
			'device.hidden = 0',
		];
		const parameters: Array<string | number> = ['property', input.match];

		if (input.scope?.roomIds) {
			predicates.push(`device."roomId" IN (${input.scope.roomIds.map(() => '?').join(', ')})`);
			parameters.push(...input.scope.roomIds);
		}

		if (input.scope?.zoneId) {
			predicates.push(
				'EXISTS (SELECT 1 FROM devices_module_devices_zones scoped_zone ' +
					'WHERE scoped_zone."deviceId" = device.id AND scoped_zone."zoneId" = ?)',
			);
			parameters.push(input.scope.zoneId);
		}

		if (input.roomParentId) {
			predicates.push(
				'device."roomId" IN (SELECT scoped_room.id FROM spaces_module_spaces scoped_room ' +
					'WHERE scoped_room."parentId" = ?)',
			);
			parameters.push(input.roomParentId);
		}

		if (input.categories) {
			predicates.push(`property.category IN (${input.categories.map(() => '?').join(', ')})`);
			parameters.push(...input.categories);
		}

		if (input.candidateCapability) {
			const permissionFilter = this.buildSearchPermissionFilter(
				input.candidateCapability === 'read'
					? [PermissionType.READ_ONLY, PermissionType.READ_WRITE]
					: [PermissionType.READ_WRITE, PermissionType.WRITE_ONLY],
			);

			predicates.push(permissionFilter.sql);
			parameters.push(...permissionFilter.parameters);

			if (input.candidateCapability === 'write') {
				predicates.push('device.enabled = 1');
				predicates.push(`property."dataType" IN (${SUPPORTED_PROPERTY_COMMAND_DATA_TYPES.map(() => '?').join(', ')})`);
				parameters.push(...SUPPORTED_PROPERTY_COMMAND_DATA_TYPES);
			}
		}

		interface PropertySearchRow extends Omit<
			VisiblePropertySearchSummary,
			'deviceEnabled' | 'rankTier' | 'lexicalScore' | 'permissions'
		> {
			deviceEnabled: boolean | number;
			rankTier: string | number;
			lexicalScore: string | number;
			permissions: string;
		}

		interface CountRow {
			total: string | number;
		}

		const joins = `FROM home_context_entity_search_fts
			 INNER JOIN devices_module_channels_properties property
			   ON property.id = home_context_entity_search_fts.entity_id
			 INNER JOIN devices_module_channels channel ON channel.id = property."channelId"
			 INNER JOIN devices_module_devices device ON device.id = channel."deviceId"`;
		const where = predicates.join('\n AND ');
		const rank = buildSqliteFtsNameRankExpression({
			ftsTable: 'home_context_entity_search_fts',
			vocabularyTable: 'home_context_entity_search_vocab',
			entityIdExpression: 'property.id',
			fallbackName: {
				vocabularyColumn: 'identifier',
				whenPrimaryNameExpression: 'property.name',
			},
			rawQuery: input.rawQuery,
			normalizedQuery: input.normalizedQuery,
			normalizedTokens: input.normalizedTokens,
		});
		const [rows, countRows] = await Promise.all([
			this.dataSource.query<PropertySearchRow[]>(
				`SELECT property.id AS id,
				        property.name AS name,
				        property.identifier AS identifier,
				        property.category AS category,
				        property."dataType" AS "dataType",
				        property.permissions AS permissions,
				        channel.id AS "channelId",
				        channel.name AS "channelName",
				        channel.category AS "channelCategory",
				        device.id AS "deviceId",
				        device.name AS "deviceName",
				        device.category AS "deviceCategory",
				        device.enabled AS "deviceEnabled",
				        device."roomId" AS "roomId",
				        ${rank.sql} AS "rankTier",
				        bm25(home_context_entity_search_fts) AS "lexicalScore"
				 ${joins}
				 WHERE ${where}
				 ORDER BY "rankTier" ASC, "lexicalScore" ASC,
				          LOWER(COALESCE(property.name, property.identifier, property.id)) ASC, property.id ASC
				 LIMIT ? OFFSET ?`,
				[...rank.parameters, ...parameters, input.limit, input.offset ?? 0],
			),
			this.dataSource.query<CountRow[]>(
				`SELECT COUNT(*) AS total
				 ${joins}
				 WHERE ${where}`,
				parameters,
			),
		]);

		return {
			properties: rows.map((row) => ({
				...row,
				deviceEnabled: Boolean(row.deviceEnabled),
				rankTier: Number(row.rankTier),
				lexicalScore: Number(row.lexicalScore),
				permissions: row.permissions.split(',') as PermissionType[],
			})),
			total: Number(countRows[0]?.total ?? 0),
		};
	}

	private buildSearchPermissionFilter(permissions: PermissionType[]): {
		sql: string;
		parameters: string[];
	} {
		const predicate = permissions
			.map(
				() =>
					'(property.permissions = ? OR property.permissions LIKE ? OR property.permissions LIKE ? ' +
					'OR property.permissions LIKE ?)',
			)
			.join(' OR ');

		return {
			sql: `(${predicate})`,
			parameters: permissions.flatMap((permission) => [
				permission,
				`${permission},%`,
				`%,${permission},%`,
				`%,${permission}`,
			]),
		};
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

		// `id` is client-suppliable here as it is on the device and channel creates, and the same two
		// hazards follow. `save()` treats a row whose primary key exists as an *update*, so a create
		// carrying an existing id moved that property under this channel instead of inserting — and
		// `DevicesService.create()`'s rollback then removed it as one of its own, destroying a property
		// the request had nothing to do with. Asked of the base repository, because a collision with a
		// property of *another* type is the same collision: ids are unique across the table.
		if (property.id) {
			const existing = await this.repository.findOne({ where: { id: property.id } });

			if (existing) {
				this.logger.error(
					`[VALIDATION FAILED] Channel property id=${property.id} already exists, refusing to create over it`,
				);

				throw new DevicesValidationException(
					`Channel property with id=${property.id} already exists. Creating a channel property with an id already in use is not allowed.`,
				);
			}
		}

		// Hook and insert together under the structure lock. What the type owner judges below is decided
		// against the device's *category* — a projection is compared to the spec slot that category
		// defines — and a device PATCH judges the reverse: the channels and properties the device already
		// has, against the category it is about to store. Each reads what the other is about to change,
		// so a property validated against the old category could commit inside the window a
		// recategorisation had already judged (see DeviceStructureLockService).
		const raw = await this.structureLock.runExclusive(async (): Promise<TProperty> => {
			// The type owner's last look at the row before it exists — the only point at which an
			// invariant spanning the property and the channel it is being attached to is decidable, since
			// `channelId` is a route parameter and never reaches the create DTO. Throwing here persists
			// nothing.
			if (mapping.beforeCreate) {
				await mapping.beforeCreate(property, channelId);
			}

			// Inserted, not saved: the check above closes the collision only for a caller who is alone,
			// and two requests carrying the same client-generated uuid can both pass it before either
			// writes. `insert()` always issues an INSERT, so the primary key constraint decides.
			await repository
				.insert(property as unknown as Parameters<Repository<TProperty>['insert']>[0])
				.catch((error: unknown) => {
					if (isPrimaryKeyCollision(error)) {
						this.logger.error(
							`[VALIDATION FAILED] Channel property id=${property.id} was created concurrently by another request`,
						);

						throw new DevicesValidationException(
							`Channel property with id=${property.id} already exists. Creating a channel property with an id already in use is not allowed.`,
						);
					}

					throw error;
				});

			return property;
		});

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
		options: ChannelPropertyUpdateOptions = {},
	): Promise<TProperty> {
		this.logger.debug(`Updating data source with id=${id}`);

		if (this.isValueOnlyUpdate(updateDto, options)) {
			const valueOnlyMapping =
				typeof updateDto.type === 'string'
					? this.getValueOnlyMapping<TProperty, TUpdateDTO>(updateDto.type)
					: undefined;

			if (valueOnlyMapping !== null) {
				const result = await this.updateValueOnly<TProperty, TUpdateDTO>(id, updateDto, valueOnlyMapping);

				if ('property' in result) {
					return result.property;
				}

				// A type-less report can only reveal a mapper's structural hooks after its one admitted
				// entity load. Leave shared admission before taking the existing exclusive path; upgrades
				// are forbidden by the lifecycle barrier.
				return this.update<TProperty, TUpdateDTO>(id, { ...updateDto, type: result.type } as TUpdateDTO, options);
			}
		}

		const property = await this.getOneOrThrow(id);

		const mapping = this.propertiesMapperService.getMapping<TProperty, any, TUpdateDTO>(property.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TProperty> = this.dataSource.getRepository(mapping.class);

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(toInstance(mapping.class, dtoInstance), isUndefined);

		// The type owner's last look at the merged row, before anything is written — the only point at
		// which an invariant spanning a field the PATCH sent and a field it did not is decidable.
		// Same lock as the create path above, for the same reason: a PATCH can move a property's data
		// type or permissions, which is exactly what a device recategorisation judges its structure by.
		// The ticket remains held through value persistence and readback as well. Stale pruning removes
		// the row under this same lock; releasing after save would let pruning delete the property and its
		// history before this PATCH resumed and appended an orphaned measurement for the deleted id.
		return this.structureLock.runExclusive(async (): Promise<TProperty> => {
			// Re-read after acquiring the ticket. Stale pruning may have removed the row while this update
			// was validating; saving the earlier entity would otherwise insert it again.
			const current = (await this.getOneOrThrow(id)) as TProperty;
			const previousCanonicalPropertyId = this.valueSourceRegistry.resolve(current);
			const entityFieldsChanged = Object.keys(updateFields).some((key) => {
				if (key === 'value' || key === 'type') {
					return false;
				}

				const newValue = (updateFields as Record<string, unknown>)[key];
				const existingValue = (current as unknown as Record<string, unknown>)[key];

				if (Array.isArray(newValue) && Array.isArray(existingValue)) {
					return JSON.stringify(newValue) !== JSON.stringify(existingValue);
				}
				if (
					typeof newValue === 'object' &&
					typeof existingValue === 'object' &&
					newValue !== null &&
					existingValue !== null
				) {
					return JSON.stringify(newValue) !== JSON.stringify(existingValue);
				}
				if (newValue === null && existingValue === null) {
					return false;
				}
				if (newValue === null || existingValue === null) {
					return true;
				}

				return newValue !== existingValue;
			});
			Object.assign(current, updateFields);
			if (entityFieldsChanged) {
				const nextCanonicalPropertyId = this.valueSourceRegistry.resolve(current);

				if (nextCanonicalPropertyId !== previousCanonicalPropertyId) {
					this.propertyCommandWindowService.cancel(previousCanonicalPropertyId);
					this.propertyCommandWindowService.cancel(nextCanonicalPropertyId);
				}
			}

			if (mapping.beforeUpdate) {
				await mapping.beforeUpdate(current);
			}

			const raw = await repository.save(current);

			// Track if value actually changed
			//
			// Deliberately not mirroring create()'s refusal above for a projected property. Service-level
			// updates can carry provider measurements, while the REST controllers remove command values and
			// dispatch them through PropertyCommandService instead. A projected property still owns no series,
			// so PropertyValueService.write() drops any value here and leaves the source's own report to record
			// what the hardware actually did.
			let valueChanged = false;
			let persistedValueState: PropertyValueState | null = null;
			let forceConfirmationValueEvent = false;
			if (typeof updateDto.value !== 'undefined') {
				const valueTimestamp = options.resolveValueTimestamp?.() ?? options.valueTimestamp;
				const canonicalPropertyId = this.valueSourceRegistry.resolve(raw);
				const validation = validatePropertyCommandValue(raw, updateDto.value);
				const expired = validation.valid ? this.propertyCommandWindowService.expire(canonicalPropertyId) : null;
				if (expired !== null) {
					this.propertyCommandWindowService.cancelRecovery(canonicalPropertyId);
				}
				const window = validation.valid ? this.propertyCommandWindowService.get(canonicalPropertyId) : null;

				if (window !== null) {
					const windowed = await this.commitWindowedProviderValue(raw, updateDto.value, async () => {
						if (options.strictValuePersistence && options.comparePersistedValue) {
							return this.propertyValueService.writeStrictIfPersistedDifferent(
								raw,
								updateDto.value,
								options.expectedPersistedState ?? null,
								options.beforeValuePersistence,
								valueTimestamp,
							);
						}

						if (options.strictValuePersistence) {
							await options.beforeValuePersistence?.();

							return this.propertyValueService.writeStrictWithState(
								raw,
								updateDto.value,
								options.storageBinding,
								valueTimestamp,
							);
						}

						return this.propertyValueService.writeWithState(raw, updateDto.value, valueTimestamp);
					});
					valueChanged = windowed.changed;
					persistedValueState = windowed.state;
					forceConfirmationValueEvent = windowed.forceValueEvent;
				} else {
					if (validation.valid) {
						this.propertyCommandWindowService.cancelRecovery(canonicalPropertyId);
					}

					if (options.strictValuePersistence && options.comparePersistedValue) {
						const result = await this.propertyValueService.writeStrictIfPersistedDifferent(
							raw,
							updateDto.value,
							options.expectedPersistedState ?? null,
							options.beforeValuePersistence,
							valueTimestamp,
						);
						valueChanged = result.changed;
						persistedValueState = result.state;
					} else if (options.strictValuePersistence) {
						await options.beforeValuePersistence?.();
						const result = await this.propertyValueService.writeStrictWithState(
							raw,
							updateDto.value,
							options.storageBinding,
							valueTimestamp,
						);
						valueChanged = result.changed;
						persistedValueState = result.state;
					} else {
						valueChanged = await this.propertyValueService.write(raw, updateDto.value, valueTimestamp);
					}
				}
			}
			const strictValueEventEmitted = options.strictValuePersistence === true && valueChanged;
			const confirmationValueEventEmitted = forceConfirmationValueEvent && !strictValueEventEmitted;

			if (strictValueEventEmitted) {
				// Persistence is already durable. Publish before post-update readback/hooks so a later failure
				// cannot make an idempotent retry skip the only value event for this measurement.
				raw.value = persistedValueState;
				this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, raw);
			} else if (confirmationValueEventEmitted) {
				raw.value = persistedValueState;
				this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, raw);
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
			} else if (valueChanged && !strictValueEventEmitted && !confirmationValueEventEmitted) {
				// Only value changed - emit CHANNEL_PROPERTY_VALUE_SET
				this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, updatedProperty);
			}

			return updatedProperty;
		});
	}

	private async updateValueOnly<TProperty extends ChannelPropertyEntity, TUpdateDTO extends UpdateChannelPropertyDto>(
		id: string,
		updateDto: TUpdateDTO,
		knownMapping: ChannelPropertyTypeMapping<TProperty, any, TUpdateDTO> | undefined,
	): Promise<{ property: TProperty } | { type: string }> {
		return this.structureLock.runShared(() =>
			this.propertyStateCoordinator.run(id, async (): Promise<{ property: TProperty } | { type: string }> => {
				// This is deliberately the sole entity load on the hot path. Disabling afterLoad avoids a
				// second property-value storage read; writeWithState below supplies the event state instead.
				const current = (await this.findOneForValueUpdate(id)) as TProperty;
				const mapping =
					knownMapping ?? this.propertiesMapperService.getMapping<TProperty, any, TUpdateDTO>(current.type);

				if (mapping.beforeUpdate || mapping.afterUpdate) {
					return { type: current.type };
				}
				const dto = await this.validateDto<TUpdateDTO>(mapping.updateDto, {
					...updateDto,
					type: updateDto.type ?? current.type,
				});

				if (dto.type !== current.type) {
					throw new DevicesValidationException('Provided property type does not match the stored property type.');
				}
				const value = dto.value;
				if (value === undefined) {
					return { type: current.type };
				}
				const commit = async (): Promise<{ property: TProperty }> => {
					const result = await this.commitWindowedProviderValue(current, value, () =>
						this.propertyValueService.writeWithState(current, value),
					);

					if (result.held) {
						return { property: current };
					}

					// Rejected/null reports have no replacement state. Keep the entity's existing read-back
					// instead of turning a harmless no-op into a visible null value.
					if (result.state !== null) {
						current.value = this.snapshotValueState(result.state);
					}

					if (result.changed || result.forceValueEvent) {
						this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, current);
					}

					return { property: current };
				};
				const canonicalPropertyId = this.valueSourceRegistry.resolve(current);

				return canonicalPropertyId === id ? commit() : this.propertyStateCoordinator.run(canonicalPropertyId, commit);
			}),
		);
	}

	/**
	 * Classifies a provider report at the serialized value-commit boundary. The writer remains the
	 * existing persistence path, so strict callers retain their storage/CAS behavior while the normal
	 * fast path can hold a stale report before it reaches cache, history, trend, or events.
	 */
	private async commitWindowedProviderValue(
		property: ChannelPropertyEntity,
		value: string | number | boolean | null,
		write: () => Promise<PropertyValueWriteResult>,
	): Promise<WindowedValueCommitResult> {
		const canonicalPropertyId = this.valueSourceRegistry.resolve(property);
		const validation = validatePropertyCommandValue(property, value);

		if (!validation.valid || validation.value === undefined) {
			const result = await write();

			return { ...result, held: false, forceValueEvent: false };
		}

		// A report that arrives at/after the deadline is fresher than a due recovery candidate. Retire
		// that candidate before its write so an old stale report can never replay after this report.
		const expired = this.propertyCommandWindowService.expire(canonicalPropertyId);
		if (expired !== null) {
			this.propertyCommandWindowService.cancelRecovery(canonicalPropertyId);
		}

		const window = this.propertyCommandWindowService.get(canonicalPropertyId);
		if (window === null) {
			this.propertyCommandWindowService.cancelRecovery(canonicalPropertyId);
			const result = await write();

			return { ...result, held: false, forceValueEvent: false };
		}

		const handle = { canonicalPropertyId, generation: window.generation };
		const receipt = { value: validation.value, receivedAt: Date.now() };

		if (window.previousValue !== null && validation.value === window.previousValue) {
			if (window.state === 'pending') {
				this.propertyCommandWindowService.hold(handle, receipt);
			}

			return { changed: false, state: null, held: true, forceValueEvent: false };
		}

		const isConfirmation = validation.value === window.commandedValue;
		const firstConfirmation = isConfirmation && window.state === 'pending';
		const result = await write();

		if (result.state === null) {
			return { ...result, held: false, forceValueEvent: false };
		}

		if (isConfirmation) {
			this.propertyCommandWindowService.confirm(handle, receipt);
		} else {
			this.propertyCommandWindowService.close(handle);
		}

		return { ...result, held: false, forceValueEvent: firstConfirmation };
	}

	private async recoverExpiredCommandWindows(): Promise<void> {
		const handles = this.propertyCommandWindowService.sweep();

		for (const handle of handles) {
			await this.structureLock.runShared(() =>
				this.propertyStateCoordinator.run(handle.canonicalPropertyId, async () => {
					const recovery = this.propertyCommandWindowService.getRecovery(handle);
					if (recovery === null || recovery.heldReceipt === null) {
						return;
					}

					let property: ChannelPropertyEntity;
					try {
						property = await this.findOneForValueUpdate(handle.canonicalPropertyId);
					} catch (error) {
						if (error instanceof DevicesNotFoundException) {
							this.propertyCommandWindowService.completeRecovery(handle);

							return;
						}

						throw error;
					}

					if (this.valueSourceRegistry.resolve(property) !== handle.canonicalPropertyId) {
						this.propertyCommandWindowService.completeRecovery(handle);

						return;
					}

					const result = await this.propertyValueService.writeWithState(property, recovery.heldReceipt.value);

					if (result.state === null || this.propertyCommandWindowService.getRecovery(handle) === null) {
						return;
					}

					property.value = this.snapshotValueState(result.state);
					if (result.changed) {
						this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
					}
					this.propertyCommandWindowService.completeRecovery(handle);
				}),
			);
		}
	}

	async remove(id: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
		return this.structureLock.runExclusive(async (): Promise<void> => {
			const property = await manager.findOne<ChannelPropertyEntity>(ChannelPropertyEntity, {
				where: { id },
			});

			if (!property) {
				this.logger.warn(`Property with id=${id} not found during removal (skipping)`);
				return;
			}
			this.propertyCommandWindowService.cancel(id);
			this.propertyCommandWindowService.cancel(this.valueSourceRegistry.resolve(property));

			// Capture property entity before removal to preserve ID for event emission
			const propertyForEvent = { ...property };

			await manager.remove(property);

			this.logger.log(`Successfully removed property with id=${id}`);

			// Emit event with the property entity captured before removal to preserve ID
			this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_DELETED, propertyForEvent);
		});
	}

	async getOneOrThrow(id: string): Promise<ChannelPropertyEntity> {
		const property = await this.findOne(id);

		if (!property) {
			this.logger.error(`Property with id=${id} not found`);

			throw new DevicesNotFoundException('Channel property does not exist');
		}

		return property;
	}

	private isValueOnlyUpdate<TUpdateDTO extends UpdateChannelPropertyDto>(
		updateDto: TUpdateDTO,
		options: ChannelPropertyUpdateOptions,
	): boolean {
		const keys = Object.keys(updateDto);

		return (
			!options.strictValuePersistence &&
			!options.resolveValueTimestamp &&
			!options.valueTimestamp &&
			updateDto.value !== undefined &&
			Object.prototype.hasOwnProperty.call(updateDto, 'value') &&
			keys.every((key) => key === 'type' || key === 'value')
		);
	}

	private getValueOnlyMapping<TProperty extends ChannelPropertyEntity, TUpdateDTO extends UpdateChannelPropertyDto>(
		type: string,
	): ChannelPropertyTypeMapping<TProperty, any, TUpdateDTO> | null {
		try {
			const mapping = this.propertiesMapperService.getMapping<TProperty, any, TUpdateDTO>(type);

			return mapping.beforeUpdate || mapping.afterUpdate ? null : mapping;
		} catch {
			return null;
		}
	}

	private async findOneForValueUpdate(id: string): Promise<ChannelPropertyEntity> {
		const property = await this.repository
			.createQueryBuilder('property')
			.innerJoinAndSelect('property.channel', 'channel')
			.innerJoinAndSelect('channel.device', 'device')
			.where('property.id = :id', { id })
			.callListeners(false)
			.getOne();

		if (!property) {
			throw new DevicesNotFoundException('Channel property does not exist');
		}

		property.unit = resolvePropertyUnit(property);

		return property;
	}

	private snapshotValueState(state: PropertyValueState | null): PropertyValueState | null {
		return state === null ? null : new PropertyValueState(state.value, state.lastUpdated, state.trend);
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
