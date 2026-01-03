import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../config/services/config.service';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { WeatherConfigModel } from '../models/config.model';
import { EventType, WEATHER_MODULE_NAME } from '../weather.constants';
import { WeatherException, WeatherNotFoundException, WeatherValidationException } from '../weather.exceptions';

import { LocationsTypeMapperService } from './locations-type-mapper.service';

@Injectable()
export class LocationsService {
	private readonly logger = createExtensionLogger(WEATHER_MODULE_NAME, 'LocationsService');

	constructor(
		@InjectRepository(WeatherLocationEntity)
		private readonly repository: Repository<WeatherLocationEntity>,
		private readonly locationsMapperService: LocationsTypeMapperService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
		private readonly configService: ConfigService,
	) {}

	async findAll<TLocation extends WeatherLocationEntity>(type?: string): Promise<TLocation[]> {
		const mapping = type ? this.locationsMapperService.getMapping<TLocation, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const locations = (await repository.find({ order: { createdAt: 'ASC' } as any })) as TLocation[];

		return locations;
	}

	async findOne<TLocation extends WeatherLocationEntity>(id: string, type?: string): Promise<TLocation | null> {
		const mapping = type ? this.locationsMapperService.getMapping<TLocation, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const location = (await repository.findOne({ where: { id } as any })) as TLocation | null;

		if (!location) {
			return null;
		}

		return location;
	}

	async create<TLocation extends WeatherLocationEntity, TCreateDTO extends CreateLocationDto>(
		createDto: TCreateDTO,
	): Promise<TLocation> {
		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" attribute in data.');

			throw new WeatherException('Location type attribute is required.');
		}

		const mapping = this.locationsMapperService.getMapping<TLocation, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Validation failed for location creation error=${JSON.stringify(errors)}`);

			throw new WeatherValidationException('Provided location data are invalid.');
		}

		const repository: Repository<TLocation> = this.dataSource.getRepository(mapping.class);

		const location = repository.create(toInstance(mapping.class, dtoInstance));

		const raw = await repository.save(location);

		let savedLocation = (await this.getOneOrThrow(raw.id)) as TLocation;

		if (mapping.afterCreate) {
			await mapping.afterCreate(savedLocation);

			savedLocation = (await this.getOneOrThrow(raw.id)) as TLocation;
		}

		this.eventEmitter.emit(EventType.LOCATION_CREATED, savedLocation);

		return savedLocation;
	}

	async update<TLocation extends WeatherLocationEntity, TUpdateDTO extends UpdateLocationDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TLocation> {
		const location = await this.getOneOrThrow(id);

		const mapping = this.locationsMapperService.getMapping<TLocation, any, TUpdateDTO>(location.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TLocation> = this.dataSource.getRepository(mapping.class);

		Object.assign(location, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		await repository.save(location as TLocation);

		let updatedLocation = (await this.getOneOrThrow(location.id)) as TLocation;

		if (mapping.afterUpdate) {
			await mapping.afterUpdate(updatedLocation);

			updatedLocation = (await this.getOneOrThrow(location.id)) as TLocation;
		}

		this.eventEmitter.emit(EventType.LOCATION_UPDATED, updatedLocation);

		return updatedLocation;
	}

	async remove(id: string): Promise<void> {
		const location = await this.getOneOrThrow(id);

		// Check if this location is set as primary
		try {
			const weatherConfig = this.configService.getModuleConfig<WeatherConfigModel>(WEATHER_MODULE_NAME);

			if (weatherConfig.primaryLocationId === id) {
				this.logger.error(`Cannot delete primary location id=${id}`);

				throw new WeatherValidationException(
					'Cannot delete the primary weather location. Please set a different primary location first.',
				);
			}
		} catch (error) {
			// If config doesn't exist or other error, allow deletion
			if (error instanceof WeatherValidationException) {
				throw error;
			}
		}

		await this.repository.remove(location);

		this.logger.log(`Successfully removed location with id=${id}`);

		this.eventEmitter.emit(EventType.LOCATION_DELETED, { id });
	}

	async getOneOrThrow(id: string): Promise<WeatherLocationEntity> {
		const location = await this.findOne(id);

		if (!location) {
			this.logger.error(`Location with id=${id} not found`);

			throw new WeatherNotFoundException('Location does not exist');
		}

		return location;
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

			throw new WeatherValidationException('Provided location data are invalid.');
		}

		return dtoInstance;
	}
}
