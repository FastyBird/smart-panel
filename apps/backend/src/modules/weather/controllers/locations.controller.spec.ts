/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { LocationsTypeMapperService } from '../services/locations-type-mapper.service';
import { LocationsService } from '../services/locations.service';
import { WeatherException } from '../weather.exceptions';

import { LocationsController } from './locations.controller';

describe('LocationsController', () => {
	let controller: LocationsController;
	let service: LocationsService;
	let mapper: LocationsTypeMapperService;

	const mockLocation: WeatherLocationEntity = {
		id: uuid().toString(),
		type: 'weather-openweathermap-onecall',
		name: 'Test Location',
		createdAt: new Date(),
		updatedAt: new Date(),
	} as WeatherLocationEntity;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [LocationsController],
			providers: [
				{
					provide: LocationsTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({})),
					},
				},
				{
					provide: LocationsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(WeatherLocationEntity, mockLocation)]),
						findOne: jest.fn().mockResolvedValue(toInstance(WeatherLocationEntity, mockLocation)),
						create: jest.fn().mockResolvedValue(toInstance(WeatherLocationEntity, mockLocation)),
						update: jest.fn().mockResolvedValue(toInstance(WeatherLocationEntity, mockLocation)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		controller = module.get<LocationsController>(LocationsController);
		service = module.get<LocationsService>(LocationsService);
		mapper = module.get<LocationsTypeMapperService>(LocationsTypeMapperService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all locations', async () => {
			const result = await controller.findAll();

			expect(result.data).toEqual([toInstance(WeatherLocationEntity, mockLocation)]);
			expect(service.findAll).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a single location', async () => {
			const result = await controller.findOne(mockLocation.id);

			expect(result.data).toEqual(toInstance(WeatherLocationEntity, mockLocation));
			expect(service.findOne).toHaveBeenCalledWith(mockLocation.id);
		});

		it('should throw NotFoundException when location not found', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(null);

			await expect(controller.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('create', () => {
		const createDto: CreateLocationDto = {
			type: 'weather-openweathermap-onecall',
			name: 'New Location',
		};

		const mockRequest = {
			url: '/api/v1/modules/weather/locations',
			protocol: 'http',
			hostname: 'localhost',
			headers: { host: 'localhost:3000' },
			socket: { localPort: 3000 },
		} as unknown as Request;

		const mockResponse = {
			header: jest.fn().mockReturnThis(),
		} as unknown as Response;

		it('should create a new location', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'weather-openweathermap-onecall',
				class: WeatherLocationEntity,
				createDto: CreateLocationDto,
				updateDto: UpdateLocationDto,
			});

			const result = await controller.create({ data: createDto }, mockResponse, mockRequest);

			expect(result.data).toEqual(toInstance(WeatherLocationEntity, mockLocation));
			expect(service.create).toHaveBeenCalled();
			expect(mockResponse.header).toHaveBeenCalledWith('Location', expect.stringContaining('/locations/'));
		});

		it('should throw BadRequestException when type is missing', async () => {
			await expect(
				controller.create({ data: { name: 'Test' } as unknown as CreateLocationDto }, mockResponse, mockRequest),
			).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException for unsupported type', async () => {
			jest.spyOn(mapper, 'getMapping').mockImplementation(() => {
				throw new WeatherException('Unsupported type');
			});

			await expect(
				controller.create(
					{ data: { type: 'invalid-type', name: 'Test' } as unknown as CreateLocationDto },
					mockResponse,
					mockRequest,
				),
			).rejects.toThrow(BadRequestException);
		});

		it('should throw UnprocessableEntityException on service error', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'weather-openweathermap-onecall',
				class: WeatherLocationEntity,
				createDto: CreateLocationDto,
				updateDto: UpdateLocationDto,
			});
			jest.spyOn(service, 'create').mockRejectedValue(new WeatherException('Creation failed'));

			await expect(controller.create({ data: createDto }, mockResponse, mockRequest)).rejects.toThrow(
				UnprocessableEntityException,
			);
		});
	});

	describe('update', () => {
		const updateDto: UpdateLocationDto = {
			type: 'weather-openweathermap-onecall',
			name: 'Updated Location',
		};

		it('should update a location', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'weather-openweathermap-onecall',
				class: WeatherLocationEntity,
				createDto: CreateLocationDto,
				updateDto: UpdateLocationDto,
			});

			const result = await controller.update(mockLocation.id, { data: updateDto });

			expect(result.data).toEqual(toInstance(WeatherLocationEntity, mockLocation));
			expect(service.update).toHaveBeenCalledWith(mockLocation.id, expect.any(Object));
		});

		it('should throw NotFoundException when location not found', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(null);

			await expect(controller.update('non-existent-id', { data: updateDto })).rejects.toThrow(NotFoundException);
		});

		it('should throw UnprocessableEntityException on service error', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'weather-openweathermap-onecall',
				class: WeatherLocationEntity,
				createDto: CreateLocationDto,
				updateDto: UpdateLocationDto,
			});
			jest.spyOn(service, 'update').mockRejectedValue(new WeatherException('Update failed'));

			await expect(controller.update(mockLocation.id, { data: updateDto })).rejects.toThrow(
				UnprocessableEntityException,
			);
		});
	});

	describe('remove', () => {
		it('should delete a location', async () => {
			const result = await controller.remove(mockLocation.id);

			expect(result).toBeUndefined();
			expect(service.remove).toHaveBeenCalledWith(mockLocation.id);
		});

		it('should throw NotFoundException when location not found', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(null);

			await expect(controller.remove('non-existent-id')).rejects.toThrow(NotFoundException);
		});
	});
});
