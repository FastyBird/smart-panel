import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

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
	private readonly logger = new Logger(LocationsService.name);

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

		this.logger.debug('[LOOKUP ALL] Fetching all locations');

		const locations = (await repository.find()) as TLocation[];

		this.logger.debug(`[LOOKUP ALL] Found ${locations.length} locations`);

		return locations;
	}

	async findOne<TLocation extends WeatherLocationEntity>(id: string, type?: string): Promise<TLocation | null> {
		const mapping = type ? this.locationsMapperService.getMapping<TLocation, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`[LOOKUP] Fetching location with id=${id}`);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const location = (await repository.findOne({ where: { id } as any })) as TLocation | null;

		if (!location) {
			this.logger.debug(`[LOOKUP] Location with id=${id} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched location with id=${id}`);

		return location;
	}

	async create<TLocation extends WeatherLocationEntity, TCreateDTO extends CreateLocationDto>(
		createDto: TCreateDTO,
	): Promise<TLocation> {
		this.logger.debug('[CREATE] Creating new location');

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" attribute in data.');

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
			this.logger.error(`[VALIDATION FAILED] Validation failed for location creation error=${JSON.stringify(errors)}`);

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

		this.logger.debug(`[CREATE] Successfully created location with id=${savedLocation.id}`);

		this.eventEmitter.emit(EventType.LOCATION_CREATED, savedLocation);

		return savedLocation;
	}

	async update<TLocation extends WeatherLocationEntity, TUpdateDTO extends UpdateLocationDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TLocation> {
		this.logger.debug(`[UPDATE] Updating location with id=${id}`);

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

		this.logger.debug(`[UPDATE] Successfully updated location with id=${updatedLocation.id}`);

		this.eventEmitter.emit(EventType.LOCATION_UPDATED, updatedLocation);

		return updatedLocation;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing location with id=${id}`);

		const location = await this.getOneOrThrow(id);

		// Check if this location is set as primary
		try {
			const weatherConfig = this.configService.getModuleConfig<WeatherConfigModel>(WEATHER_MODULE_NAME);

			if (weatherConfig.primaryLocationId === id) {
				this.logger.error(`[DELETE] Cannot delete primary location id=${id}`);

				throw new WeatherValidationException('Cannot delete the primary weather location. Please set a different primary location first.');
			}
		} catch (error) {
			// If config doesn't exist or other error, allow deletion
			if (error instanceof WeatherValidationException) {
				throw error;
			}

			this.logger.debug(`[DELETE] Could not check primary location status, proceeding with deletion`);
		}

		await this.repository.remove(location);

		this.logger.log(`[DELETE] Successfully removed location with id=${id}`);

		this.eventEmitter.emit(EventType.LOCATION_DELETED, { id });
	}

	async getOneOrThrow(id: string): Promise<WeatherLocationEntity> {
		const location = await this.findOne(id);

		if (!location) {
			this.logger.error(`[ERROR] Location with id=${id} not found`);

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
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new WeatherValidationException('Provided location data are invalid.');
		}

		return dtoInstance;
	}
}
