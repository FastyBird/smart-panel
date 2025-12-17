/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ConfigService } from '../../config/services/config.service';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { WeatherConfigModel } from '../models/config.model';
import { EventType, WEATHER_MODULE_NAME } from '../weather.constants';
import { WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

import { LocationsTypeMapperService } from './locations-type-mapper.service';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
	let service: LocationsService;
	let repository: Repository<WeatherLocationEntity>;
	let locationsMapperService: LocationsTypeMapperService;
	let eventEmitter: EventEmitter2;
	let configService: ConfigService;

	const mockLocationId = uuid().toString();

	const mockLocation: WeatherLocationEntity = {
		id: mockLocationId,
		type: 'weather-openweathermap-onecall',
		name: 'Test Location',
		createdAt: new Date(),
		updatedAt: new Date(),
	} as WeatherLocationEntity;

	const mockWeatherConfig: WeatherConfigModel = {
		type: WEATHER_MODULE_NAME,
		primaryLocationId: null,
	} as WeatherConfigModel;

	const mockMapping = {
		type: 'weather-openweathermap-onecall',
		class: WeatherLocationEntity,
		createDto: CreateLocationDto,
		updateDto: UpdateLocationDto,
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LocationsService,
				{
					provide: getRepositoryToken(WeatherLocationEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([mockLocation]),
						findOne: jest.fn().mockResolvedValue(mockLocation),
						create: jest.fn().mockReturnValue(mockLocation),
						save: jest.fn().mockResolvedValue(mockLocation),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: LocationsTypeMapperService,
					useValue: {
						getMapping: jest.fn().mockReturnValue(mockMapping),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn().mockReturnValue({
							find: jest.fn().mockResolvedValue([mockLocation]),
							findOne: jest.fn().mockResolvedValue(mockLocation),
							create: jest.fn().mockReturnValue(mockLocation),
							save: jest.fn().mockResolvedValue(mockLocation),
						}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: jest.fn().mockReturnValue(mockWeatherConfig),
					},
				},
			],
		}).compile();

		service = module.get<LocationsService>(LocationsService);
		repository = module.get<Repository<WeatherLocationEntity>>(getRepositoryToken(WeatherLocationEntity));
		locationsMapperService = module.get<LocationsTypeMapperService>(LocationsTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		configService = module.get<ConfigService>(ConfigService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all locations', async () => {
			const result = await service.findAll();

			expect(result).toEqual([mockLocation]);
			expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' } });
		});

		it('should filter by type when provided', async () => {
			await service.findAll('weather-openweathermap-onecall');

			expect(locationsMapperService.getMapping).toHaveBeenCalledWith('weather-openweathermap-onecall');
		});
	});

	describe('findOne', () => {
		it('should return a location by id', async () => {
			const result = await service.findOne(mockLocationId);

			expect(result).toEqual(mockLocation);
		});

		it('should return null when location not found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findOne('non-existent-id');

			expect(result).toBeNull();
		});
	});

	describe('create', () => {
		const createDto: CreateLocationDto = {
			type: 'weather-openweathermap-onecall',
			name: 'New Location',
		};

		it('should create a new location', async () => {
			const result = await service.create(createDto);

			expect(result).toEqual(mockLocation);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.LOCATION_CREATED, expect.any(Object));
		});

		it('should throw WeatherException when type is missing', async () => {
			const invalidDto = { name: 'Test' } as CreateLocationDto;

			await expect(service.create(invalidDto)).rejects.toThrow();
		});
	});

	describe('update', () => {
		const updateDto: UpdateLocationDto = {
			type: 'weather-openweathermap-onecall',
			name: 'Updated Location',
		};

		it('should update a location', async () => {
			const result = await service.update(mockLocationId, updateDto);

			expect(result).toEqual(mockLocation);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.LOCATION_UPDATED, expect.any(Object));
		});

		it('should throw WeatherNotFoundException when location not found', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(null);

			await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(WeatherNotFoundException);
		});
	});

	describe('remove', () => {
		it('should delete a location', async () => {
			await service.remove(mockLocationId);

			expect(repository.remove).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.LOCATION_DELETED, { id: mockLocationId });
		});

		it('should throw WeatherNotFoundException when location not found', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(null);

			await expect(service.remove('non-existent-id')).rejects.toThrow(WeatherNotFoundException);
		});

		it('should throw WeatherValidationException when trying to delete primary location', async () => {
			const primaryConfig: WeatherConfigModel = {
				type: WEATHER_MODULE_NAME,
				primaryLocationId: mockLocationId,
			} as WeatherConfigModel;

			jest.spyOn(configService, 'getModuleConfig').mockReturnValue(primaryConfig);

			await expect(service.remove(mockLocationId)).rejects.toThrow(WeatherValidationException);
		});
	});

	describe('getOneOrThrow', () => {
		it('should return location when found', async () => {
			const result = await service.getOneOrThrow(mockLocationId);

			expect(result).toEqual(mockLocation);
		});

		it('should throw WeatherNotFoundException when not found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.getOneOrThrow('non-existent-id')).rejects.toThrow(WeatherNotFoundException);
		});
	});
});
