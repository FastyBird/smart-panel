/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { DataSource, EntityManager, InsertResult, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { type StorageBackendBinding } from '../../storage/services/storage.service';
import { ChannelCategory, DataTypeType, EventType, PermissionType, PropertyCategory } from '../devices.constants';
import { DevicesException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';
import { SUPPORTED_PROPERTY_COMMAND_DATA_TYPES } from '../utils/property-command-value.utils';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

class MockChannel extends ChannelEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

class MockChannelProperty extends ChannelPropertyEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

class CreateMockChannelPropertyDto extends CreateChannelPropertyDto {
	@Expose()
	@IsString()
	mock_value: string;
}

class UpdateMockChannelPropertyDto extends UpdateChannelPropertyDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;
}

describe('ChannelsPropertiesService', () => {
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;
	let structureLock: DeviceStructureLockService;
	let repository: Repository<ChannelPropertyEntity>;
	let mapper: ChannelsPropertiesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: DataSource;
	let propertyValueService: jest.Mocked<PropertyValueService>;
	let valueSourceRegistry: PropertyValueSourceRegistryService;

	const mockChannel: MockChannel = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		identifier: null,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: uuid().toString(),
		parentId: null,
		parent: null,
		children: [],
		controls: [],
		properties: [],
		mockValue: 'Some value',
	};

	const mockChannelProperty: MockChannelProperty = {
		id: uuid().toString(),
		type: 'mock',
		name: 'Test Property',
		category: PropertyCategory.GENERIC,
		identifier: null,
		permissions: [PermissionType.READ_ONLY],
		dataType: DataTypeType.STRING,
		unit: null,
		format: null,
		invalid: null,
		step: 0.5,
		value: new PropertyValueState('22.5'),
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some value',
	};

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
		findOne: jest.fn(),
		remove: jest.fn(),
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			// Rows are inserted rather than saved, so a client-supplied id that already exists collides on
			// the primary key instead of quietly turning the create into an update.
			insert: jest.fn().mockResolvedValue({ identifiers: [{}], generatedMaps: [], raw: [] }),
			remove: jest.fn(),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ChannelsPropertiesService,
				// Dependency-free and re-entrant, so the real one is used: what it serializes is exactly
				// what these tests exercise.
				DeviceStructureLockService,
				{ provide: getRepositoryToken(ChannelPropertyEntity), useFactory: mockRepository },
				{
					provide: ChannelsPropertiesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: MockChannelProperty,
							createDto: CreateMockChannelPropertyDto,
							updateDto: UpdateMockChannelPropertyDto,
						})),
					},
				},
				{
					provide: PropertyValueService,
					useValue: {
						write: jest.fn(() => {}),
						writeStrict: jest.fn(() => {}),
						writeStrictWithState: jest.fn(() => {}),
						writeStrictIfPersistedDifferent: jest.fn(() => {}),
						readLatestStrict: jest.fn(),
						readLatestManyStrict: jest.fn(),
					},
				},
				PropertyValueSourceRegistryService,
				{
					provide: DataSource,
					useValue: {
						manager: mockManager,
						transaction: jest.fn(async (cb: (m: any) => any) => await cb(mockManager)),
						getRepository: jest.fn(() => {}),
						query: jest.fn(),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
		structureLock = module.get<DeviceStructureLockService>(DeviceStructureLockService);
		repository = module.get<Repository<ChannelPropertyEntity>>(getRepositoryToken(ChannelPropertyEntity));
		mapper = module.get<ChannelsPropertiesTypeMapperService>(ChannelsPropertiesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<DataSource>(DataSource);
		propertyValueService = module.get<PropertyValueService>(PropertyValueService) as jest.Mocked<PropertyValueService>;
		valueSourceRegistry = module.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(channelsService).toBeDefined();
		expect(channelsPropertiesService).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all properties for a channel', async () => {
			const mockProperties: MockChannelProperty[] = [mockChannelProperty];

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockProperties.map((entity) => toInstance(MockChannelProperty, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findAll(mockChannel.id);

			expect(result).toEqual(mockProperties.map((entity) => toInstance(MockChannelProperty, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findWritableCandidates', () => {
		it('bounds candidates and filters hidden, disabled, and non-writable targets in the query', async () => {
			const queryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				getManyAndCount: jest.fn().mockResolvedValue([[mockChannelProperty], 125]),
			};
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);

			await expect(channelsPropertiesService.findWritableCandidates(100)).resolves.toEqual({
				properties: [mockChannelProperty],
				total: 125,
			});
			expect(queryBuilder.where).toHaveBeenCalledWith('device.enabled = :enabled', { enabled: true });
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('device.hidden = :hidden', { hidden: false });
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('property.dataType IN (:...supportedDataTypes)', {
				supportedDataTypes: SUPPORTED_PROPERTY_COMMAND_DATA_TYPES,
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('property.permissions'),
				expect.objectContaining({ readWrite: PermissionType.READ_WRITE, writeOnly: PermissionType.WRITE_ONLY }),
			);
			expect(queryBuilder.orderBy).toHaveBeenCalledTimes(1);
			expect(queryBuilder.orderBy).toHaveBeenCalledWith('device.name', 'ASC');
			expect(queryBuilder.addOrderBy).toHaveBeenCalledTimes(3);
			expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(1, 'channel.name', 'ASC');
			expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(2, 'property.name', 'ASC');
			expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(3, 'property.id', 'ASC');
			expect(queryBuilder.callListeners).toHaveBeenCalledWith(false);
			expect(queryBuilder.take).toHaveBeenCalledWith(100);
			expect(queryBuilder.skip).toHaveBeenCalledWith(0);
		});
	});

	describe('findVisibleReadableStateCandidates', () => {
		const createCandidateQueryBuilder = (properties: ChannelPropertyEntity[] = [], total = 0) => ({
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			innerJoin: jest.fn().mockReturnThis(),
			addSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			callListeners: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			skip: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn().mockResolvedValue([properties, total]),
		});

		it('applies visibility, readability, resolved scope, metadata filters, and deterministic bounds in SQL', async () => {
			const disabledVisibleProperty = {
				...mockChannelProperty,
				channel: {
					...mockChannel,
					device: {
						id: 'disabled-device',
						name: 'Disabled visible sensor',
						hidden: false,
						enabled: false,
					},
				},
			} as unknown as ChannelPropertyEntity;
			const queryBuilder = createCandidateQueryBuilder([disabledVisibleProperty], 42);
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);

			await expect(
				channelsPropertiesService.findVisibleReadableStateCandidates({
					limit: 100,
					offset: 7,
					scope: { roomIds: ['room-id'], zoneId: 'zone-id' },
					roomParentId: 'floor-id',
					channelCategories: [ChannelCategory.TEMPERATURE],
					propertyCategories: [PropertyCategory.GENERIC],
					dataTypes: [DataTypeType.FLOAT],
				}),
			).resolves.toEqual({ properties: [disabledVisibleProperty], total: 42 });

			expect(queryBuilder.innerJoinAndSelect).toHaveBeenNthCalledWith(1, 'property.channel', 'channel');
			expect(queryBuilder.innerJoinAndSelect).toHaveBeenNthCalledWith(2, 'channel.device', 'device');
			expect(queryBuilder.where).toHaveBeenCalledWith('device.hidden = :hidden', { hidden: false });
			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('property.permissions = :readOnly'),
				expect.objectContaining({
					readOnly: PermissionType.READ_ONLY,
					readWrite: PermissionType.READ_WRITE,
				}),
			);
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('device.roomId IN (:...roomIds)', {
				roomIds: ['room-id'],
			});
			expect(queryBuilder.innerJoin).toHaveBeenCalledWith('device.deviceZones', 'stateCandidateZone');
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('stateCandidateZone.zoneId = :zoneId', {
				zoneId: 'zone-id',
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('state_candidate_room.parentId = :roomParentId'),
				{ roomParentId: 'floor-id' },
			);
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('channel.category IN (:...channelCategories)', {
				channelCategories: [ChannelCategory.TEMPERATURE],
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('property.category IN (:...propertyCategories)', {
				propertyCategories: [PropertyCategory.GENERIC],
			});
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('property.dataType IN (:...dataTypes)', {
				dataTypes: [DataTypeType.FLOAT],
			});
			const whereCalls = queryBuilder.where.mock.calls as Array<[string, ...unknown[]]>;
			const andWhereCalls = queryBuilder.andWhere.mock.calls as Array<[string, ...unknown[]]>;
			const predicates = [...whereCalls, ...andWhereCalls].map(([predicate]) => predicate);
			expect(predicates.some((predicate) => predicate.includes('device.enabled'))).toBe(false);
			expect(queryBuilder.orderBy).toHaveBeenCalledWith('device.name', 'ASC');
			expect(queryBuilder.addSelect).toHaveBeenCalledWith(
				'COALESCE(property.name, property.identifier, property.id)',
				'stateCandidatePropertyOrder',
			);
			expect(queryBuilder.addOrderBy.mock.calls).toEqual([
				['device.id', 'ASC'],
				['channel.name', 'ASC'],
				['channel.id', 'ASC'],
				['stateCandidatePropertyOrder', 'ASC'],
				['property.id', 'ASC'],
			]);
			expect(queryBuilder.callListeners).toHaveBeenCalledWith(false);
			expect(queryBuilder.take).toHaveBeenCalledWith(100);
			expect(queryBuilder.skip).toHaveBeenCalledWith(7);
			expect(propertyValueService.readLatestStrict).not.toHaveBeenCalled();
			expect(propertyValueService.readLatestManyStrict).not.toHaveBeenCalled();
		});

		it('accepts the exact hard cap and rejects a larger page before constructing a query', async () => {
			const queryBuilder = createCandidateQueryBuilder([], 501);
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);

			await expect(channelsPropertiesService.findVisibleReadableStateCandidates({ limit: 500 })).resolves.toEqual({
				properties: [],
				total: 501,
			});
			expect(queryBuilder.take).toHaveBeenCalledWith(500);

			jest.mocked(repository.createQueryBuilder).mockClear();
			await expect(channelsPropertiesService.findVisibleReadableStateCandidates({ limit: 501 })).rejects.toThrow(
				'At most 500 visible readable state candidates',
			);
			expect(repository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it.each([
			{ limit: 0 },
			{ limit: 10, scope: { roomIds: [] } },
			{ limit: 10, channelCategories: [] },
			{ limit: 10, propertyCategories: [] },
			{ limit: 10, dataTypes: [] },
		])('short-circuits an explicitly empty candidate set %#', async (input) => {
			await expect(channelsPropertiesService.findVisibleReadableStateCandidates(input)).resolves.toEqual({
				properties: [],
				total: 0,
			});
			expect(repository.createQueryBuilder).not.toHaveBeenCalled();
		});
	});

	describe('searchVisibleSummaryPage', () => {
		it('returns bounded joined metadata without reading values or excluding disabled owners', async () => {
			const query = jest.spyOn(dataSource, 'query');
			query
				.mockResolvedValueOnce([
					{
						id: mockChannelProperty.id,
						name: mockChannelProperty.name,
						identifier: null,
						category: PropertyCategory.GENERIC,
						dataType: DataTypeType.STRING,
						permissions: `${PermissionType.READ_ONLY},${PermissionType.READ_WRITE}`,
						channelId: mockChannel.id,
						channelName: mockChannel.name,
						channelCategory: ChannelCategory.GENERIC,
						deviceId: 'device-id',
						deviceName: 'Disabled sensor',
						deviceCategory: 'generic',
						deviceEnabled: 0,
						roomId: null,
						rankTier: '3',
						lexicalScore: '-5',
					},
				])
				.mockResolvedValueOnce([{ total: '4' }]);

			await expect(
				channelsPropertiesService.searchVisibleSummaryPage({
					match: '"temperature"*',
					rawQuery: 'temperature',
					normalizedQuery: 'temperature',
					offset: 3,
					limit: 20,
					roomParentId: 'floor-id',
					categories: [PropertyCategory.GENERIC],
				}),
			).resolves.toEqual({
				properties: [
					expect.objectContaining({
						id: mockChannelProperty.id,
						deviceEnabled: false,
						rankTier: 3,
						lexicalScore: -5,
						permissions: [PermissionType.READ_ONLY, PermissionType.READ_WRITE],
					}),
				],
				total: 4,
			});
			const [selectSql, selectParameters] = query.mock.calls[0] as [string, unknown[]];
			const [countSql, countParameters] = query.mock.calls[1] as [string, unknown[]];
			expect(selectSql).toContain('home_context_entity_search_fts MATCH ?');
			expect(selectSql.match(/INNER JOIN devices_module_channels channel/g)).toHaveLength(1);
			expect(selectSql.match(/INNER JOIN devices_module_devices device/g)).toHaveLength(1);
			expect(selectSql).toContain('device.hidden = 0');
			expect(selectSql).not.toContain('device.enabled = 1');
			expect(selectSql).toContain('device."roomId" IN (SELECT scoped_room.id FROM spaces_module_spaces scoped_room');
			expect(selectSql).toContain('scoped_room."parentId" = ?');
			expect(selectSql).toContain('property.category IN (?)');
			expect(selectSql).toContain('WHEN property.id = ? COLLATE NOCASE THEN 0');
			expect(selectSql).toContain('FROM home_context_entity_search_vocab exact_count');
			expect(selectSql).toContain('FROM home_context_entity_search_vocab prefix_term');
			expect(selectSql).toContain("exact_term_fallback.col = 'identifier'");
			expect(selectSql).toContain('property.name IS NULL');
			expect(selectSql).toContain('ORDER BY "rankTier" ASC, "lexicalScore" ASC');
			expect(selectSql).toContain('LOWER(COALESCE(property.name, property.identifier, property.id)) ASC');
			expect(selectSql).not.toContain('LOWER(device.name) ASC');
			expect(selectSql).not.toContain('LOWER(channel.name) ASC');
			expect(selectParameters).toEqual([
				'temperature',
				1,
				'temperature',
				1,
				'temperature',
				1,
				'temperature%',
				1,
				'temperature%',
				'property',
				'"temperature"*',
				'floor-id',
				PropertyCategory.GENERIC,
				20,
				3,
			]);
			expect(countSql).toContain('SELECT COUNT(*) AS total');
			expect(countParameters).toEqual(['property', '"temperature"*', 'floor-id', PropertyCategory.GENERIC]);
			expect(propertyValueService.readLatestManyStrict).not.toHaveBeenCalled();
		});

		it('does not query an explicitly empty scope', async () => {
			await expect(
				channelsPropertiesService.searchVisibleSummaryPage({
					match: 'temperature',
					limit: 20,
					scope: { roomIds: [] },
				}),
			).resolves.toEqual({ properties: [], total: 0 });
			expect(dataSource.query).not.toHaveBeenCalled();
		});

		it('filters readable candidates by exact permission boundaries while retaining disabled owners', async () => {
			const query = jest.spyOn(dataSource, 'query');
			query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

			await channelsPropertiesService.searchVisibleSummaryPage({
				match: '"sensor"*',
				offset: 7,
				limit: 10,
				scope: { zoneId: 'zone-id' },
				categories: [PropertyCategory.GENERIC],
				candidateCapability: 'read',
			});

			const [selectSql, selectParameters] = query.mock.calls[0] as [string, unknown[]];
			const [countSql, countParameters] = query.mock.calls[1] as [string, unknown[]];
			for (const sql of [selectSql, countSql]) {
				expect(sql).toContain('device.hidden = 0');
				expect(sql).toContain('devices_module_devices_zones scoped_zone');
				expect(sql).toContain('property.category IN (?)');
				expect(sql).toContain('property.permissions = ?');
				expect(sql).toContain('property.permissions LIKE ?');
				expect(sql).not.toContain('device.enabled = 1');
				expect(sql).not.toContain('property."dataType" IN');
			}
			const filterParameters = [
				'property',
				'"sensor"*',
				'zone-id',
				PropertyCategory.GENERIC,
				PermissionType.READ_ONLY,
				`${PermissionType.READ_ONLY},%`,
				`%,${PermissionType.READ_ONLY},%`,
				`%,${PermissionType.READ_ONLY}`,
				PermissionType.READ_WRITE,
				`${PermissionType.READ_WRITE},%`,
				`%,${PermissionType.READ_WRITE},%`,
				`%,${PermissionType.READ_WRITE}`,
			];
			expect(selectParameters).toEqual([null, ...filterParameters, 10, 7]);
			expect(countParameters).toEqual(filterParameters);
		});

		it('filters writable candidates by permissions, command data type, and enabled owner before paging', async () => {
			const query = jest.spyOn(dataSource, 'query');
			query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

			await channelsPropertiesService.searchVisibleSummaryPage({
				match: '"switch"*',
				offset: 5,
				limit: 20,
				roomParentId: 'floor-id',
				candidateCapability: 'write',
			});

			const [selectSql, selectParameters] = query.mock.calls[0] as [string, unknown[]];
			const [countSql, countParameters] = query.mock.calls[1] as [string, unknown[]];
			for (const sql of [selectSql, countSql]) {
				expect(sql).toContain('device.hidden = 0');
				expect(sql).toContain('scoped_room."parentId" = ?');
				expect(sql).toContain('property.permissions = ?');
				expect(sql).toContain('device.enabled = 1');
				expect(sql).toContain(
					`property."dataType" IN (${SUPPORTED_PROPERTY_COMMAND_DATA_TYPES.map(() => '?').join(', ')})`,
				);
			}
			const filterParameters = [
				'property',
				'"switch"*',
				'floor-id',
				PermissionType.READ_WRITE,
				`${PermissionType.READ_WRITE},%`,
				`%,${PermissionType.READ_WRITE},%`,
				`%,${PermissionType.READ_WRITE}`,
				PermissionType.WRITE_ONLY,
				`${PermissionType.WRITE_ONLY},%`,
				`%,${PermissionType.WRITE_ONLY},%`,
				`%,${PermissionType.WRITE_ONLY}`,
				...SUPPORTED_PROPERTY_COMMAND_DATA_TYPES,
			];
			expect(selectParameters).toEqual([null, ...filterParameters, 20, 5]);
			expect(countParameters).toEqual(filterParameters);
		});
	});

	describe('findBoundedForChannels', () => {
		it('selects capped property IDs before hydrating values', async () => {
			const countQuery: any = {
				innerJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ channelId: mockChannel.id, propertyCount: '45' }]),
			};
			const entityQuery: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mockChannelProperty]),
			};
			jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: mockChannelProperty.id }]);
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValueOnce(countQuery).mockReturnValueOnce(entityQuery);

			await expect(channelsPropertiesService.findBoundedForChannels([mockChannel.id], 40)).resolves.toEqual({
				properties: [mockChannelProperty],
				totals: { [mockChannel.id]: 45 },
			});
			expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('ROW_NUMBER() OVER'), [mockChannel.id, 40]);
			expect(dataSource.query).toHaveBeenCalledWith(
				expect.stringContaining(`ORDER BY COALESCE(property."name", ''), property."id"`),
				[mockChannel.id, 40],
			);
			expect(entityQuery.where).toHaveBeenCalledWith('property.id IN (:...propertyIds)', {
				propertyIds: [mockChannelProperty.id],
			});
			expect(entityQuery.callListeners).toHaveBeenCalledWith(true);
		});

		it('strictly reloads bounded values and propagates storage failures', async () => {
			const countQuery: any = {
				innerJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ channelId: mockChannel.id, propertyCount: '1' }]),
			};
			const entityQuery: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mockChannelProperty]),
			};
			jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: mockChannelProperty.id }]);
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValueOnce(countQuery).mockReturnValueOnce(entityQuery);
			propertyValueService.readLatestManyStrict.mockRejectedValue(new Error('storage unavailable'));

			await expect(
				channelsPropertiesService.findBoundedForChannels([mockChannel.id], 40, true, [PropertyCategory.GENERIC]),
			).rejects.toThrow('storage unavailable');
			expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('property."category" IN (?)'), [
				mockChannel.id,
				PropertyCategory.GENERIC,
				40,
			]);
			expect(countQuery.andWhere).toHaveBeenCalledWith('property.category IN (:...propertyCategories)', {
				propertyCategories: [PropertyCategory.GENERIC],
			});
			expect(entityQuery.callListeners).toHaveBeenCalledWith(false);
			expect(propertyValueService.readLatestManyStrict).toHaveBeenCalledWith([mockChannelProperty]);
		});
	});

	describe('findOne', () => {
		it('should return a channel property if found', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findOne(mockChannelProperty.id, mockChannel.id);

			expect(result).toEqual(toInstance(MockChannelProperty, mockChannelProperty));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: mockChannelProperty.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if the channel property is not found', async () => {
			const propertyId = uuid().toString();

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findOne(propertyId, mockChannel.id);

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: propertyId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		const projectedPropertyId = uuid().toString();

		// `id` is client-suppliable, and `save()` treats a row whose primary key exists as an *update*: a
		// create carrying an existing id moved that property under this channel, and `DevicesService`'s
		// rollback then removed it as one of its own — a malformed request destroying a property it had
		// nothing to do with.
		it('refuses a create naming a property id that already exists, before anything is written', async () => {
			const takenId = uuid().toString();

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(repository, 'create').mockReturnValue({ id: takenId } as MockChannelProperty);
			jest.spyOn(repository, 'findOne').mockResolvedValue({ id: takenId } as ChannelPropertyEntity);

			await expect(
				channelsPropertiesService.create(mockChannel.id, {
					id: takenId,
					type: 'mock',
					category: PropertyCategory.GENERIC,
					permissions: [PermissionType.READ_ONLY],
					data_type: DataTypeType.UNKNOWN,
					mock_value: 'Random text',
				} as CreateMockChannelPropertyDto),
			).rejects.toThrow(DevicesValidationException);

			expect(repository.insert).not.toHaveBeenCalled();
			expect(repository.save).not.toHaveBeenCalled();
		});

		// The check above closes the collision only for a caller who is alone: two requests carrying the
		// same client-generated uuid can both pass it before either writes.
		it('reports a concurrent duplicate property id as the same refusal the check gives', async () => {
			const takenId = uuid().toString();

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(repository, 'create').mockReturnValue({ id: takenId } as MockChannelProperty);
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);
			jest
				.spyOn(repository, 'insert')
				.mockRejectedValue(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: properties.id'));

			await expect(
				channelsPropertiesService.create(mockChannel.id, {
					id: takenId,
					type: 'mock',
					category: PropertyCategory.GENERIC,
					permissions: [PermissionType.READ_ONLY],
					data_type: DataTypeType.UNKNOWN,
					mock_value: 'Random text',
				} as CreateMockChannelPropertyDto),
			).rejects.toThrow(DevicesValidationException);
		});

		it('should create and return a new channel property', async () => {
			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
				mock_value: 'Random text',
			};
			const mockCreateProperty: Partial<MockChannelProperty> = {
				type: createDto.type,
				category: createDto.category,
				name: createDto.name,
				permissions: createDto.permissions,
				dataType: createDto.data_type,
				channel: mockChannel.id,
				mockValue: createDto.mock_value,
			};
			const mockCreatedProperty: MockChannelProperty = {
				id: uuid().toString(),
				type: mockCreateProperty.type,
				category: mockCreateProperty.category,
				identifier: mockCreateProperty.identifier,
				name: mockCreateProperty.name,
				permissions: mockCreateProperty.permissions,
				dataType: mockCreateProperty.dataType,
				unit: null,
				format: mockCreateProperty.format,
				invalid: mockCreateProperty.invalid,
				step: mockCreateProperty.step,
				value: mockCreateProperty.value,
				channel: mockCreateProperty.channel,
				createdAt: new Date(),
				updatedAt: null,
				mockValue: mockCreateProperty.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(toInstance(MockChannelProperty, mockCreatedProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(repository, 'create').mockReturnValue(toInstance(ChannelPropertyEntity, mockCreatedProperty));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockCreatedProperty));

			const result = await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(result).toEqual(toInstance(MockChannelProperty, mockCreatedProperty));
			expect(repository.create).toHaveBeenCalledWith(toInstance(MockChannelProperty, mockCreateProperty));
			// Inserted, not saved: `save()` would treat a client-supplied id that already exists as an update.
			expect(repository.insert).toHaveBeenCalledWith(toInstance(ChannelPropertyEntity, mockCreatedProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_CREATED,
				toInstance(MockChannelProperty, mockCreatedProperty),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: mockCreatedProperty.id });
		});

		it('should throw DevicesException if the channel property type is not provided', async () => {
			const createDto: Partial<CreateChannelPropertyDto> = {
				category: PropertyCategory.GENERIC,
			};

			await expect(
				channelsPropertiesService.create(mockChannel.id, createDto as CreateMockChannelPropertyDto),
			).rejects.toThrow(DevicesException);
		});

		// A property whose value is stored under another property's key has no series of its own to
		// seed, and creation dispatches no command the value could have meant instead — so the only
		// thing it could become is a measurement of the *source* device that its hardware never
		// reported. Refused before the row is saved, so nothing is left behind either.
		it('should refuse a value supplied for a property whose value is stored by another property', async () => {
			valueSourceRegistry.register({
				getType: () => 'mock',
				resolve: (property) => (property.id === projectedPropertyId ? 'some-other-property-id' : null),
			});

			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.FLOAT,
				value: 21.5,
				mock_value: 'Random text',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: projectedPropertyId });

			jest.spyOn(repository, 'create').mockReturnValue(created);

			const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(created);

			// Everything downstream is wired to succeed, so a build without the guard creates the row
			// and writes the value straight into the source's series rather than failing for some
			// unrelated reason further along.
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(channelsPropertiesService.create(mockChannel.id, createDto)).rejects.toThrow(
				DevicesValidationException,
			);

			// The source's series is never reached, and no half-created row survives the refusal.
			expect(propertyValueService.write).not.toHaveBeenCalled();
			expect(saveSpy).not.toHaveBeenCalled();
			expect(repository.insert).not.toHaveBeenCalled();
		});

		it('should still store a value for a property that owns its series', async () => {
			valueSourceRegistry.register({
				getType: () => 'mock',
				resolve: (property) => (property.id === projectedPropertyId ? 'some-other-property-id' : null),
			});

			const ownPropertyId = uuid().toString();

			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.FLOAT,
				value: 21.5,
				mock_value: 'Random text',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: ownPropertyId });

			jest.spyOn(repository, 'create').mockReturnValue(created);
			jest.spyOn(repository, 'save').mockResolvedValue(created);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(propertyValueService.write).toHaveBeenCalledWith(created, 21.5);
		});

		// The counterpart to `beforeUpdate`. It exists so a type owner can judge an invariant spanning
		// the property and the channel it is being attached to — and `channelId` is a route parameter on
		// both property controllers, so it never reaches the create DTO and has to be handed over here.

		it('should call the mapping beforeCreate hook with the channel id, before saving', async () => {
			const beforeCreate = jest.fn().mockResolvedValue(undefined);

			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
				mock_value: 'Random text',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeCreate,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: uuid().toString() });

			jest.spyOn(repository, 'create').mockReturnValue(created);

			const insertSpy = jest
				.spyOn(repository, 'insert')
				.mockResolvedValue({ identifiers: [{}], generatedMaps: [], raw: [] } as InsertResult);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(beforeCreate).toHaveBeenCalledTimes(1);
			expect(beforeCreate.mock.calls[0][1]).toBe(mockChannel.id);
			expect(beforeCreate.mock.invocationCallOrder[0]).toBeLessThan(insertSpy.mock.invocationCallOrder[0]);
		});

		// The hook judges the row against the device's *category* — a projection is compared to the spec
		// slot that category defines — while a device PATCH judges the reverse, the structure the device
		// already has against the category it is about to store. Each reads what the other is about to
		// change, so both windows have to be inside the same lock or a property validated against the old
		// category can commit inside the window a recategorisation had already judged.
		it('takes the structure lock around the hook and the insert, not just around one of them', async () => {
			const order: string[] = [];
			const beforeCreate = jest.fn().mockImplementation((): Promise<void> => {
				order.push('hook');

				return Promise.resolve();
			});

			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
				mock_value: 'Random text',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeCreate,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: uuid().toString() });

			jest.spyOn(repository, 'create').mockReturnValue(created);
			jest.spyOn(repository, 'insert').mockImplementation((): Promise<InsertResult> => {
				order.push('insert');

				return Promise.resolve({ identifiers: [{}], generatedMaps: [], raw: [] } as InsertResult);
			});

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(structureLock, 'runExclusive').mockImplementation(async <T>(work: () => Promise<T>): Promise<T> => {
				order.push('lock:enter');

				const result = await work();

				order.push('lock:exit');

				return result;
			});

			await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(order).toEqual(['lock:enter', 'hook', 'insert', 'lock:exit']);
		});

		it('should persist nothing when the beforeCreate hook rejects the attachment', async () => {
			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
				mock_value: 'Random text',
			};

			const afterCreate = jest.fn();

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeCreate: jest.fn().mockRejectedValue(new DevicesValidationException('Wrong kind of channel.')),
				afterCreate,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: uuid().toString() });

			jest.spyOn(repository, 'create').mockReturnValue(created);

			const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(created);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(channelsPropertiesService.create(mockChannel.id, createDto)).rejects.toThrow(
				DevicesValidationException,
			);

			// No row, no event, and no afterCreate hook — a refused attachment leaves nothing behind for
			// anything downstream to observe.
			expect(saveSpy).not.toHaveBeenCalled();
			expect(repository.insert).not.toHaveBeenCalled();
			expect(afterCreate).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	describe('update', () => {
		it('uses strict value persistence when the caller requires retry-safe storage', async () => {
			const storageBinding = {} as StorageBackendBinding;
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest
				.spyOn(channelsPropertiesService, 'getOneOrThrow')
				.mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));
			const persistedState = new PropertyValueState('new value', '2026-08-21T12:00:00.000Z');
			propertyValueService.writeStrictWithState.mockResolvedValue({ changed: true, state: persistedState });

			await channelsPropertiesService.update(
				mockChannelProperty.id,
				{ type: 'mock', value: 'new value' } as UpdateMockChannelPropertyDto,
				{ strictValuePersistence: true, storageBinding },
			);

			expect(propertyValueService.writeStrictWithState).toHaveBeenCalledWith(
				expect.objectContaining({ id: mockChannelProperty.id }),
				'new value',
				storageBinding,
			);
			expect(propertyValueService.write).not.toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_VALUE_SET,
				expect.objectContaining({ id: mockChannelProperty.id }),
			);
		});

		it('delegates comparison and persistence to one atomic property-value operation', async () => {
			const property = toInstance(MockChannelProperty, mockChannelProperty);
			const persistedState = new PropertyValueState('new value', '2026-08-21T12:00:00.000Z');
			const beforeValuePersistence = jest.fn().mockResolvedValue(undefined);
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsPropertiesService, 'getOneOrThrow').mockResolvedValue(property);
			jest.spyOn(repository, 'save').mockResolvedValue(property);
			propertyValueService.writeStrictIfPersistedDifferent.mockResolvedValue({
				changed: true,
				state: persistedState,
			});

			await channelsPropertiesService.update(
				property.id,
				{ type: 'mock', value: 'new value' } as UpdateMockChannelPropertyDto,
				{
					strictValuePersistence: true,
					comparePersistedValue: true,
					expectedPersistedState: null,
					beforeValuePersistence,
				},
			);

			expect(propertyValueService.writeStrictIfPersistedDifferent).toHaveBeenCalledWith(
				expect.objectContaining({ id: property.id }),
				'new value',
				null,
				beforeValuePersistence,
			);
			expect(propertyValueService.writeStrictWithState).not.toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_VALUE_SET,
				expect.objectContaining({ id: property.id, value: persistedState }),
			);
		});

		it('emits a strict value event before a post-persistence readback failure', async () => {
			const storageBinding = {} as StorageBackendBinding;
			const property = toInstance(MockChannelProperty, mockChannelProperty);
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest
				.spyOn(channelsPropertiesService, 'getOneOrThrow')
				.mockResolvedValueOnce(property)
				.mockResolvedValueOnce(property)
				.mockRejectedValueOnce(new Error('post-write readback failed'));
			jest.spyOn(repository, 'save').mockResolvedValue(property);
			const persistedState = new PropertyValueState('durable value', '2026-08-21T12:00:00.000Z');
			propertyValueService.writeStrictWithState.mockResolvedValue({ changed: true, state: persistedState });

			await expect(
				channelsPropertiesService.update(
					property.id,
					{ type: 'mock', value: 'durable value' } as UpdateMockChannelPropertyDto,
					{ strictValuePersistence: true, storageBinding },
				),
			).rejects.toThrow('post-write readback failed');

			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_VALUE_SET,
				expect.objectContaining({ id: property.id, value: persistedState }),
			);
		});

		it('does not save an entity removed before the update acquires the structure lock', async () => {
			const property = toInstance(MockChannelProperty, mockChannelProperty);
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest
				.spyOn(channelsPropertiesService, 'getOneOrThrow')
				.mockResolvedValueOnce(property)
				.mockRejectedValueOnce(new Error('property was pruned'));

			await expect(
				channelsPropertiesService.update(property.id, {
					type: 'mock',
					name: 'late update',
				} as UpdateMockChannelPropertyDto),
			).rejects.toThrow('property was pruned');

			expect(repository.save).not.toHaveBeenCalled();
			expect(propertyValueService.write).not.toHaveBeenCalled();
		});

		it('detects a change against the row re-read under the structure lock', async () => {
			const initial = toInstance(MockChannelProperty, mockChannelProperty);
			const concurrent = toInstance(MockChannelProperty, { ...mockChannelProperty, name: 'Concurrent name' });
			const restored = toInstance(MockChannelProperty, mockChannelProperty);
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest
				.spyOn(channelsPropertiesService, 'getOneOrThrow')
				.mockResolvedValueOnce(initial)
				.mockResolvedValueOnce(concurrent)
				.mockResolvedValueOnce(restored);
			jest.spyOn(repository, 'save').mockResolvedValue(restored);

			await channelsPropertiesService.update(initial.id, {
				type: 'mock',
				name: initial.name,
			} as UpdateMockChannelPropertyDto);

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_PROPERTY_UPDATED, restored);
		});

		it('should update existing and return a channel property', async () => {
			const updateDto: UpdateMockChannelPropertyDto = {
				type: 'mock',
				name: 'New name',
				step: 0.1,
				mock_value: 'Changed text',
			};
			const mockUpdateProperty: MockChannelProperty = {
				id: mockChannelProperty.id,
				type: mockChannelProperty.type,
				category: mockChannelProperty.category,
				identifier: mockChannelProperty.identifier,
				name: updateDto.name,
				permissions: mockChannelProperty.permissions,
				dataType: mockChannelProperty.dataType,
				unit: null,
				format: mockChannelProperty.format,
				invalid: mockChannelProperty.invalid,
				step: updateDto.step,
				value: mockChannelProperty.value,
				channel: mockChannelProperty.channel,
				createdAt: mockChannelProperty.createdAt,
				updatedAt: mockChannelProperty.updatedAt,
				mockValue: updateDto.mock_value,
			};
			const mockUpdatedProperty: MockChannelProperty = {
				id: mockUpdateProperty.id,
				type: mockUpdateProperty.type,
				category: mockUpdateProperty.category,
				identifier: mockUpdateProperty.identifier,
				name: mockUpdateProperty.name,
				permissions: mockUpdateProperty.permissions,
				dataType: mockUpdateProperty.dataType,
				unit: null,
				format: mockUpdateProperty.format,
				invalid: mockUpdateProperty.invalid,
				step: mockUpdateProperty.step,
				value: mockUpdateProperty.value,
				channel: mockUpdateProperty.channel,
				createdAt: mockUpdateProperty.createdAt,
				updatedAt: new Date(),
				mockValue: mockUpdateProperty.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockChannelProperty, mockChannelProperty))
					.mockResolvedValueOnce(toInstance(MockChannelProperty, mockChannelProperty))
					.mockResolvedValueOnce(toInstance(MockChannelProperty, mockUpdatedProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockUpdatedProperty));

			const result = await channelsPropertiesService.update(mockChannelProperty.id, updateDto);

			expect(result).toEqual(toInstance(MockChannelProperty, mockUpdatedProperty));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockChannelProperty, mockUpdateProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_UPDATED,
				toInstance(MockChannelProperty, mockUpdatedProperty),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: mockUpdatedProperty.id });
		});

		// The hook exists so a type owner can judge an invariant spanning a field the PATCH sent and a
		// field it did not — which is only decidable once the two are merged, and only useful if that
		// happens before anything is written.

		it('should call the mapping beforeUpdate hook with the merged row, before saving it', async () => {
			const beforeUpdate = jest.fn().mockResolvedValue(undefined);

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeUpdate,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty));

			await channelsPropertiesService.update(mockChannelProperty.id, {
				type: 'mock',
				name: 'New name',
			} as UpdateMockChannelPropertyDto);

			expect(beforeUpdate).toHaveBeenCalledTimes(1);
			// The merged row: the field the PATCH sent, on the entity that was loaded from storage.
			expect((beforeUpdate.mock.calls[0][0] as MockChannelProperty).name).toBe('New name');
			expect((beforeUpdate.mock.calls[0][0] as MockChannelProperty).id).toBe(mockChannelProperty.id);
			expect(beforeUpdate.mock.invocationCallOrder[0]).toBeLessThan(
				(repository.save as jest.Mock).mock.invocationCallOrder[0],
			);
		});

		it('should leave the row untouched when the beforeUpdate hook rejects it', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeUpdate: jest.fn().mockRejectedValue(new DevicesValidationException('Merged row is not supported.')),
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty));

			await expect(
				channelsPropertiesService.update(mockChannelProperty.id, {
					type: 'mock',
					name: 'New name',
				} as UpdateMockChannelPropertyDto),
			).rejects.toThrow(DevicesValidationException);

			expect(repository.save).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should remove a channel property', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));
			mockManager.findOne = jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));

			jest.spyOn(mockManager, 'remove');

			await channelsPropertiesService.remove(mockChannelProperty.id);

			expect(mockManager.findOne).toHaveBeenCalledWith(ChannelPropertyEntity, {
				where: { id: mockChannelProperty.id },
			});
			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(MockChannelProperty, mockChannelProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_DELETED,
				toInstance(MockChannelProperty, mockChannelProperty),
			);
		});
	});
});
