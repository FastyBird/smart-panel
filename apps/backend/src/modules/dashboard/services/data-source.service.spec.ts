/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { IsString } from 'class-validator';
import { useContainer } from 'class-validator';
import { DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
	ChannelCategoryEnum,
	DataTypeEnum,
	DeviceCategoryEnum,
	PermissionEnum,
	PropertyCategoryEnum,
} from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService } from '../../devices/services/devices.service';
import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { EventType } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateDeviceChannelDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDeviceChannelDataSourceDto } from '../dto/update-data-source.dto';
import {
	DataSourceEntity,
	DeviceChannelDataSourceEntity,
	DeviceTileEntity,
	TilesPageEntity,
} from '../entities/dashboard.entity';
import { ChannelPropertyExistsConstraintValidator } from '../validators/channel-property-exists-constraint.validator';
import { DeviceChannelExistsConstraintValidator } from '../validators/device-channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { CardsService } from './cards.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourceService } from './data-source.service';
import { PagesService } from './pages.service';
import { TilesService } from './tiles.service';

class MockDevice extends DeviceEntity {
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

describe('DataSourceService', () => {
	let pagesService: PagesService;
	let tilesService: TilesService;
	let dataSourceService: DataSourceService;
	let repository: Repository<DataSourceEntity>;
	let mapper: DataSourcesTypeMapperService;
	let gateway: WebsocketGateway;
	let dataSource: OrmDataSource;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;

	const mockDevice: MockDevice = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategoryEnum.GENERIC,
		name: 'Test Device',
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
		mockValue: 'Some value',
	};

	const mockChannel: ChannelEntity = {
		id: uuid().toString(),
		category: ChannelCategoryEnum.GENERIC,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice.id,
		controls: [],
		properties: [],
	};

	const mockChannelProperty: ChannelPropertyEntity = {
		id: uuid().toString(),
		name: 'Test Property',
		category: PropertyCategoryEnum.GENERIC,
		permission: [PermissionEnum.READ_ONLY],
		dataType: DataTypeEnum.STRING,
		unit: '°C',
		format: null,
		invalid: null,
		step: 0.5,
		value: '22.5',
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockTilesPage: TilesPageEntity = {
		id: uuid().toString(),
		type: 'tiles',
		title: 'Tiles detail',
		order: 0,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockDeviceTile: DeviceTileEntity = {
		id: uuid().toString(),
		type: 'device',
		page: mockTilesPage.id,
		card: null,
		device: mockDevice.id,
		dataSource: [],
		row: 0,
		col: 0,
		rowSpan: 0,
		colSpan: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		validateOwnership: (): void => {},
	};

	const mockDeviceChannelDataSource: DeviceChannelDataSourceEntity = {
		id: uuid().toString(),
		type: 'device_channel',
		tile: mockDeviceTile.id,
		card: null,
		page: null,
		device: mockDevice.id,
		channel: mockChannel.id,
		property: mockChannelProperty.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		validateOwnership: (): void => {},
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
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
				DataSourceService,
				DeviceExistsConstraintValidator,
				DeviceChannelExistsConstraintValidator,
				ChannelPropertyExistsConstraintValidator,
				{ provide: getRepositoryToken(DataSourceEntity), useFactory: mockRepository },
				{
					provide: PagesService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: CardsService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: TilesService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn(() => {}),
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findOne: jest.fn(() => {}),
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOne: jest.fn(() => {}),
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: WebsocketGateway,
					useValue: {
						sendMessage: jest.fn(() => {}),
					},
				},
				{
					provide: OrmDataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		pagesService = module.get<PagesService>(PagesService);
		tilesService = module.get<TilesService>(TilesService);
		dataSourceService = module.get<DataSourceService>(DataSourceService);
		repository = module.get<Repository<DataSourceEntity>>(getRepositoryToken(DataSourceEntity));
		mapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);
		gateway = module.get<WebsocketGateway>(WebsocketGateway);
		dataSource = module.get<OrmDataSource>(OrmDataSource);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(pagesService).toBeDefined();
		expect(tilesService).toBeDefined();
		expect(dataSourceService).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(gateway).toBeDefined();
		expect(dataSource).toBeDefined();
		expect(devicesService).toBeDefined();
		expect(channelsService).toBeDefined();
		expect(channelsPropertiesService).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all data sources with relations', async () => {
			const mockDataSources: DataSourceEntity[] = [mockDeviceChannelDataSource];

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(DeviceTileEntity, mockDeviceTile));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest
					.fn()
					.mockResolvedValue(mockDataSources.map((entity) => plainToInstance(DeviceChannelDataSourceEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await dataSourceService.findAll({ tileId: mockDeviceTile.id });

			expect(result).toEqual(mockDataSources.map((entity) => plainToInstance(DeviceChannelDataSourceEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('dataSource');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('dataSource.tile', 'tile');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.device', 'device');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.channel', 'channel');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.property', 'property');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :tileId', { tileId: mockDeviceTile.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a tile by ID', async () => {
			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(DeviceTileEntity, mockDeviceTile));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValue(plainToInstance(DeviceChannelDataSourceEntity, mockDeviceChannelDataSource)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await dataSourceService.findOne(mockDeviceChannelDataSource.id, { tileId: mockDeviceTile.id });

			expect(result).toEqual(plainToInstance(DeviceChannelDataSourceEntity, mockDeviceChannelDataSource));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('dataSource');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('dataSource.tile', 'tile');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.device', 'device');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.channel', 'channel');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.property', 'property');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('dataSource.id = :id', {
				id: mockDeviceChannelDataSource.id,
			});
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('tile.id = :tileId', { tileId: mockDeviceTile.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if page not found', async () => {
			const dataSourceId = uuid().toString();

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(DeviceTileEntity, mockDeviceTile));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await dataSourceService.findOne(dataSourceId, { tileId: mockDeviceTile.id });

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('dataSource');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('dataSource.tile', 'tile');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.device', 'device');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.channel', 'channel');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('dataSource.property', 'property');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('dataSource.id = :id', { id: dataSourceId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('tile.id = :tileId', { tileId: mockDeviceTile.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new data source', async () => {
			const createDto: CreateDeviceChannelDataSourceDto = {
				type: 'device_channel',
				device: mockDevice.id,
				channel: mockChannel.id,
				property: mockChannelProperty.id,
			};
			const mockCrateDataSource: Partial<DeviceChannelDataSourceEntity> = {
				type: createDto.type,
				device: createDto.device,
				channel: createDto.channel,
				property: createDto.property,
				tile: mockDeviceTile.id,
			};
			const mockCratedDataSource: DeviceChannelDataSourceEntity = {
				id: uuid().toString(),
				type: mockCrateDataSource.type,
				device: mockCrateDataSource.device,
				channel: mockCrateDataSource.channel,
				property: mockCrateDataSource.property,
				tile: mockCrateDataSource.tile,
				card: null,
				page: null,
				createdAt: new Date(),
				updatedAt: null,
				validateOwnership: (): void => {},
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(DeviceTileEntity, mockDeviceTile));
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(plainToInstance(MockDevice, mockDevice));
			jest.spyOn(channelsService, 'findOne').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));
			jest
				.spyOn(channelsPropertiesService, 'findOne')
				.mockResolvedValue(plainToInstance(ChannelPropertyEntity, mockChannelProperty));

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'device_channel',
				class: DeviceChannelDataSourceEntity,
				createDto: CreateDeviceChannelDataSourceDto,
				updateDto: UpdateDeviceChannelDataSourceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(DeviceChannelDataSourceEntity, mockCratedDataSource));
			jest.spyOn(repository, 'create').mockReturnValue(mockCratedDataSource);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCratedDataSource);

			const result = await dataSourceService.create(createDto, { tileId: mockDeviceTile.id });

			expect(result).toEqual(plainToInstance(DeviceChannelDataSourceEntity, mockCratedDataSource));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(DeviceChannelDataSourceEntity, mockCrateDataSource, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCratedDataSource);
			expect(gateway.sendMessage).toHaveBeenCalledWith(
				EventType.TILE_DATA_SOURCE_CREATED,
				plainToInstance(DeviceChannelDataSourceEntity, mockCratedDataSource),
			);
			expect(repository.findOne).toHaveBeenCalledWith({
				relations: ['tile', 'tile.page', 'device', 'channel', 'property'],
				where: { id: mockCratedDataSource.id },
			});
		});

		it('should throw validation exception for invalid data', async () => {
			const createDto: Partial<CreateDeviceChannelDataSourceDto> = {
				device: mockDevice.id,
				channel: mockChannel.id,
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(DeviceTileEntity, mockDeviceTile));

			await expect(
				dataSourceService.create(createDto as CreateDeviceChannelDataSourceDto, { tileId: mockDeviceTile.id }),
			).rejects.toThrow(DashboardException);
		});
	});

	describe('update', () => {
		it('should update a data source', async () => {
			const updateDto: UpdateDeviceChannelDataSourceDto = {
				property: mockChannelProperty.id,
			};
			const mockUpdateDataSource: DeviceChannelDataSourceEntity = {
				id: mockDeviceChannelDataSource.id,
				type: mockDeviceChannelDataSource.type,
				device: mockDeviceChannelDataSource.device,
				channel: mockDeviceChannelDataSource.channel,
				property: updateDto.property,
				tile: mockDeviceChannelDataSource.tile,
				card: null,
				page: null,
				createdAt: mockDeviceChannelDataSource.createdAt,
				updatedAt: mockDeviceChannelDataSource.updatedAt,
				validateOwnership: (): void => {},
			};
			const mockUpdatedDataSource: DeviceChannelDataSourceEntity = {
				id: mockUpdateDataSource.id,
				type: mockUpdateDataSource.type,
				device: mockUpdateDataSource.device,
				channel: mockUpdateDataSource.channel,
				property: mockUpdateDataSource.property,
				tile: mockUpdateDataSource.tile,
				card: null,
				page: null,
				createdAt: mockUpdateDataSource.createdAt,
				updatedAt: mockUpdateDataSource.updatedAt,
				validateOwnership: (): void => {},
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(DeviceTileEntity, mockDeviceTile));
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(plainToInstance(MockDevice, mockDevice));
			jest.spyOn(channelsService, 'findOne').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));
			jest
				.spyOn(channelsPropertiesService, 'findOne')
				.mockResolvedValue(plainToInstance(ChannelPropertyEntity, mockChannelProperty));

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'device_channel',
				class: DeviceChannelDataSourceEntity,
				createDto: CreateDeviceChannelDataSourceDto,
				updateDto: UpdateDeviceChannelDataSourceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(DeviceChannelDataSourceEntity, mockDeviceChannelDataSource))
				.mockResolvedValueOnce(plainToInstance(DeviceChannelDataSourceEntity, mockUpdatedDataSource));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedDataSource);

			const result = await dataSourceService.update(mockDeviceChannelDataSource.id, updateDto);

			expect(result).toEqual(plainToInstance(DeviceChannelDataSourceEntity, mockUpdatedDataSource));
			expect(repository.save).toHaveBeenCalledWith(
				plainToInstance(DeviceChannelDataSourceEntity, mockUpdatedDataSource),
			);
			expect(gateway.sendMessage).toHaveBeenCalledWith(
				EventType.TILE_DATA_SOURCE_UPDATED,
				plainToInstance(DeviceChannelDataSourceEntity, mockUpdatedDataSource),
			);
			expect(repository.findOne).toHaveBeenCalledWith({
				relations: ['tile', 'tile.page', 'device', 'channel', 'property'],
				where: { id: mockDeviceChannelDataSource.id },
			});
		});
	});

	describe('remove', () => {
		it('should remove a data source', async () => {
			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(DeviceTileEntity, mockDeviceTile));
			jest
				.spyOn(dataSourceService, 'findOne')
				.mockResolvedValue(plainToInstance(DeviceChannelDataSourceEntity, mockDeviceChannelDataSource));

			jest.spyOn(repository, 'remove').mockResolvedValue(mockDeviceChannelDataSource);

			await dataSourceService.remove(mockDeviceChannelDataSource.id);

			expect(repository.remove).toHaveBeenCalledWith(
				plainToInstance(DeviceChannelDataSourceEntity, mockDeviceChannelDataSource),
			);
			expect(gateway.sendMessage).toHaveBeenCalledWith(
				EventType.TILE_DATA_SOURCE_DELETED,
				plainToInstance(DeviceChannelDataSourceEntity, mockDeviceChannelDataSource),
			);
		});
	});
});
